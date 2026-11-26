// Profile fields of `User` (CLE-129/T8.1, D-58, AD-29). Rules only: no React,
// Prisma or env. The server stores the values; the client renders them.
import { z } from "zod";

/**
 * AD-29: closed set of genders. `null` means "not specified" and is the
 * default for everybody, so the column is nullable and the field is optional.
 */
export const GENDERS = ["MALE", "FEMALE"] as const;

export const genderSchema = z.enum(GENDERS);

export type Gender = (typeof GENDERS)[number];

/**
 * AD-29: «Обо мне» is plain text of at most 500 Unicode code points. The unit
 * is the one Zod counts with `max()` and the one PostgreSQL `char_length()`
 * counts in the migration CHECK, so the form, the contract and the column agree.
 */
export const ABOUT_MAX = 500;

/**
 * ISO 3166-1 alpha-2, packed two letters per code to keep the app bundle small
 * (the budget in AGENTS.md is a couple of kilobytes). `Intl.supportedValuesOf()`
 * has no `region` key, so the list lives here instead of being generated at
 * runtime; the client builds the display names with `Intl.DisplayNames`
 * (AD-29) and the server stores only the upper-case code.
 */
const COUNTRY_CODES_PACKED =
  "ADAEAFAGAIALAMAOAQARASATAUAWAXAZBABBBDBEBFBGBHBIBJBLBMBNBOBQBRBSBTBVBWBYBZCACCCDCFCGCHCICKCLCMCNCOCRCUCVCWCXCYCZDEDJDKDMDODZECEEEGEHERESETFIFJFKFMFOFRGAGBGDGEGFGGGHGIGLGMGNGPGQGRGSGTGUGWGYHKHMHNHRHTHUIDIEILIMINIOIQIRISITJEJMJOJPKEKGKHKIKMKNKPKRKWKYKZLALBLCLILKLRLSLTLULVLYMAMCMDMEMFMGMHMKMLMMMNMOMPMQMRMSMTMUMVMWMXMYMZNANCNENFNGNINLNONPNRNUNZOMPAPEPFPGPHPKPLPMPNPRPSPTPWPYQARERORSRURWSASBSCSDSESGSHSISJSKSLSMSNSOSRSSSTSVSXSYSZTCTDTFTGTHTJTKTLTMTNTOTRTTTVTWTZUAUGUMUSUYUZVAVCVEVGVIVNVUWFWSYEYTZAZMZW";

/** The whole ISO 3166-1 alpha-2 list (249 codes), never mutated. */
export const COUNTRY_CODES: readonly string[] = COUNTRY_CODES_PACKED.match(/.{2}/g) ?? [];

const COUNTRY_CODE_SET = new Set(COUNTRY_CODES);

/** True for an upper-case ISO 3166-1 alpha-2 code from {@link COUNTRY_CODES}. */
export function isCountryCode(value: string): boolean {
  return COUNTRY_CODE_SET.has(value);
}

/**
 * AD-23/AD-29: a birthday is stored without a year, so 29 February is allowed
 * and February stops at 29. The check is by month only; a year never reaches it.
 */
export function isValidBirthDate(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  const lastDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return day >= 1 && day <= lastDay;
}

/** Empty form inputs arrive as `""`; they mean "no value", not an invalid one. */
function blankToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

/**
 * PostgreSQL cannot store `U+0000` in `text`, so a body carrying it would pass
 * the length rules and fail only on insert — a 500 instead of `VALIDATION`.
 */
function hasNoNul(value: string): boolean {
  return !value.includes("\u0000");
}

const birthDayFieldSchema = z.number().int().min(1).max(31).nullable().optional();
const birthMonthFieldSchema = z.number().int().min(1).max(12).nullable().optional();

/**
 * The country is stored as the code. Surrounding spaces are trimmed and the
 * code is upper-cased before the list is checked, so `"by"` is accepted and
 * stored as `"BY"`; a value outside the list is `VALIDATION` (AD-29).
 */
const countryFieldSchema = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .toUpperCase()
    .refine(isCountryCode, { message: "country must be an ISO 3166-1 alpha-2 code" })
    .nullable()
    .optional(),
);

const aboutFieldSchema = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(ABOUT_MAX)
    .refine(hasNoNul, { message: "Text cannot contain NUL" })
    .nullable()
    .optional(),
);

/**
 * AD-29: the profile fields as they sit on `User` and as `GET /api/v1/me/profile`
 * answers them. All of them are required in the answer: `null` is "not set", not
 * a missing key, so the screen can tell an empty field from an absent one.
 */
export const profileFieldsSchema = z.strictObject({
  birthDay: z.number().int().nullable(),
  birthMonth: z.number().int().nullable(),
  gender: genderSchema.nullable(),
  country: z.string().nullable(),
  about: z.string().nullable(),
  profileVisibleToFriends: z.boolean(),
});

export type ProfileFields = z.infer<typeof profileFieldsSchema>;

/**
 * `PATCH /api/v1/me/profile` (AD-29). Every field is optional: an absent key
 * means "leave as is", `null` means "clear". A birthday is one pair — a body
 * that touches it must carry **both** `birthDay` and `birthMonth` (or both
 * `null`), because a single day cannot be stored: the pair rule is checked
 * here and again on the server. The year is not a field and is not accepted.
 */
export const profileUpdateBodySchema = z
  .strictObject({
    birthDay: birthDayFieldSchema,
    birthMonth: birthMonthFieldSchema,
    gender: genderSchema.nullable().optional(),
    country: countryFieldSchema,
    about: aboutFieldSchema,
    profileVisibleToFriends: z.boolean().optional(),
  })
  .superRefine(function checkBirthDate(value, ctx) {
    const hasDay = value.birthDay !== undefined && value.birthDay !== null;
    const hasMonth = value.birthMonth !== undefined && value.birthMonth !== null;
    if (hasDay !== hasMonth) {
      ctx.addIssue({
        code: "custom",
        path: ["birthDay"],
        message: "Birth day and month are set together",
      });
      return;
    }
    if (hasDay && hasMonth && !isValidBirthDate(value.birthDay as number, value.birthMonth as number)) {
      ctx.addIssue({
        code: "custom",
        path: ["birthDay"],
        message: "Birth day does not exist in that month",
      });
    }
  });

export type ProfileUpdateBody = z.infer<typeof profileUpdateBodySchema>;
