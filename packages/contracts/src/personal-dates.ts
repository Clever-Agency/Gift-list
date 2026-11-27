// Personal dates of a profile (CLE-141, Story 7.5, AD-23, FR-38/FR-43, D-22).
// Rules only: no React, Prisma or env. The birthday is not here: it is a day and
// a month on `User` without a year (D-58, AD-29).
import { z } from "zod";

/**
 * The title is shown on one line of the list, so it is short by design: at most
 * 40 Unicode code points after trimming — the unit of Zod `max()` and of the
 * PostgreSQL `VARCHAR(40)` in the migration, so the form, the contract and the
 * column agree.
 */
export const PERSONAL_DATE_TITLE_MAX = 40;

/**
 * AD-23 / Story 7.5: a user keeps at most 10 `CUSTOM` dates. The birthday is not
 * counted — it lives on `User` and is not a `UserDate` row.
 */
export const PERSONAL_DATES_MAX = 10;

/** A year below this is a typo, not a date (AD-23). */
export const PERSONAL_DATE_MIN_YEAR = 1900;

/** Closed `UserDate.kind` set: R1 stores only custom dates (AD-23). */
export const USER_DATE_KINDS = ["CUSTOM"] as const;

export const userDateKindSchema = z.enum(USER_DATE_KINDS);

export type UserDateKind = (typeof USER_DATE_KINDS)[number];

/**
 * Closed visibility set of a personal date (AD-23). The same set gates the date
 * itself and its year, but the two answers are independent: «все» on the date
 * does not open the year.
 */
export const DATE_VISIBILITIES = ["ONLY_ME", "FRIENDS", "EVERYONE"] as const;

export const dateVisibilitySchema = z.enum(DATE_VISIBILITIES);

export type DateVisibility = (typeof DATE_VISIBILITIES)[number];

/** Story 7.5: «друзья» is the default visibility of a new date. */
export const DEFAULT_DATE_VISIBILITY = "FRIENDS" satisfies DateVisibility;

/** AD-23: the year is «только я» by default and has to be opened separately. */
export const DEFAULT_DATE_YEAR_VISIBILITY = "ONLY_ME" satisfies DateVisibility;

/** Last day of a month in a common year; February is widened in a leap year. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * AD-23: the stored day and month must form a real date. Without a year February
 * stops at 29, so 29 February is accepted (no year is stored yet); with a year
 * the leap rule applies, so 29 February 2023 is refused and 29 February 2024 is
 * accepted. A day that does not exist in the month (31 April) is always refused.
 */
export function isValidPersonalDate(day: number, month: number, year?: number | null): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  if (month === 2) {
    // Without a year February stops at 29, so 29 February is a valid date; with
    // a year the leap rule decides.
    const lastDay = year === undefined || year === null || isLeapYear(year) ? 29 : 28;
    return day >= 1 && day <= lastDay;
  }
  return day >= 1 && day <= (DAYS_IN_MONTH[month - 1] ?? 0);
}

/**
 * AD-23: a year is in [1900, the current year]. A year in the future makes no
 * sense for an anniversary or a birthday. `now` is injectable so the server and
 * the tests share one rule; the check reads the UTC year, like `formatDate()`.
 */
export function isPersonalDateYearAllowed(year: number, now: Date = new Date()): boolean {
  return (
    Number.isInteger(year) &&
    year >= PERSONAL_DATE_MIN_YEAR &&
    year <= now.getUTCFullYear()
  );
}

/** PostgreSQL cannot store `U+0000` in `varchar`, so it is refused up front. */
function hasNoNul(value: string): boolean {
  return !value.includes("\u0000");
}

const titleFieldSchema = z
  .string()
  .trim()
  .min(1)
  .max(PERSONAL_DATE_TITLE_MAX)
  .refine(hasNoNul, { message: "Text cannot contain NUL" });

/** Day and month are always set, unlike the birthday pair on `User`. */
const dayFieldSchema = z.number().int().min(1).max(31);
const monthFieldSchema = z.number().int().min(1).max(12);

/**
 * The year is optional: without it the date is an anniversary that repeats every
 * year. `null` and an absent key both mean "no year" on creation; `9999` is the
 * upper bound of the range, while "not in the future" is checked below.
 */
const yearFieldSchema = z
  .number()
  .int()
  .min(PERSONAL_DATE_MIN_YEAR)
  .max(9999)
  .nullable()
  .optional();

/**
 * Story 7.5: body of `POST /api/v1/me/dates`. The two visibility switches carry
 * their defaults here, so neither client hard-codes them. The limit of 10 is a
 * use-case rule: it needs the stored count and is checked in one transaction.
 */
export const personalDateCreateBodySchema = z
  .strictObject({
    title: titleFieldSchema,
    day: dayFieldSchema,
    month: monthFieldSchema,
    year: yearFieldSchema,
    visibility: dateVisibilitySchema.default(DEFAULT_DATE_VISIBILITY),
    yearVisibility: dateVisibilitySchema.default(DEFAULT_DATE_YEAR_VISIBILITY),
  })
  .superRefine(function checkPersonalDate(value, context) {
    if (!isValidPersonalDate(value.day, value.month, value.year ?? null)) {
      context.addIssue({
        code: "custom",
        path: ["day"],
        message: "Day does not exist in that month",
      });
      return;
    }
    if (value.year !== undefined && value.year !== null && !isPersonalDateYearAllowed(value.year)) {
      context.addIssue({
        code: "custom",
        path: ["year"],
        message: "Year cannot be in the future",
      });
    }
  });

export type PersonalDateCreateBody = z.infer<typeof personalDateCreateBodySchema>;

/**
 * Story 7.5: body of `PATCH /api/v1/me/dates/:id`. An absent key keeps the
 * stored value; `year: null` clears the year. Day and month change together,
 * because a day alone cannot be checked against the stored month; a body that
 * touches only the year is validated against the stored day/month by the server
 * (29 February with a non-leap year is refused there).
 */
export const personalDateUpdateBodySchema = z
  .strictObject({
    title: titleFieldSchema.optional(),
    day: dayFieldSchema.optional(),
    month: monthFieldSchema.optional(),
    year: yearFieldSchema,
    visibility: dateVisibilitySchema.optional(),
    yearVisibility: dateVisibilitySchema.optional(),
  })
  .refine(function hasAnyField(value) {
    return Object.values(value).some((field) => field !== undefined);
  }, {
    message: "At least one field is required",
  })
  .superRefine(function checkPersonalDateUpdate(value, context) {
    const day = value.day;
    const month = value.month;

    if ((day === undefined) !== (month === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["day"],
        message: "Day and month change together",
      });
      return;
    }

    if (
      day !== undefined &&
      month !== undefined &&
      !isValidPersonalDate(day, month, value.year ?? null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["day"],
        message: "Day does not exist in that month",
      });
      return;
    }

    if (value.year !== undefined && value.year !== null && !isPersonalDateYearAllowed(value.year)) {
      context.addIssue({
        code: "custom",
        path: ["year"],
        message: "Year cannot be in the future",
      });
    }
  });

export type PersonalDateUpdateBody = z.infer<typeof personalDateUpdateBodySchema>;

/**
 * The owner's own answer (`GET /api/v1/me/dates`): every stored field, including
 * both visibility switches, so the edit form can show the current choices.
 * `kind` is a closed enum rather than a free string; R1 knows only `CUSTOM`.
 */
export const personalDateSchema = z.strictObject({
  id: z.string(),
  kind: userDateKindSchema,
  title: z.string(),
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  year: z.number().int().nullable(),
  visibility: dateVisibilitySchema,
  yearVisibility: dateVisibilitySchema,
});

export type PersonalDate = z.infer<typeof personalDateSchema>;

/**
 * What another viewer gets on `/u/:nick` (AD-23). The row is the same date, but
 * without the visibility switches — those are the owner's settings, not somebody
 * else's data. `year` is `null` when the date has no year or when the year is
 * hidden from this viewer; the two cases are indistinguishable on purpose, so a
 * closed year never reveals that there is one.
 */
export const visiblePersonalDateSchema = z.strictObject({
  id: z.string(),
  kind: userDateKindSchema,
  title: z.string(),
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12),
  year: z.number().int().nullable(),
});

export type VisiblePersonalDate = z.infer<typeof visiblePersonalDateSchema>;
