import { describe, expect, it } from "vitest";
import {
  ABOUT_MAX,
  COUNTRY_CODES,
  isCountryCode,
  isValidBirthDate,
  myProfileSchema,
  profileUpdateBodySchema,
} from "./index";

describe("profile contract (CLE-129/T8.1, AD-29)", () => {
  it("ships the whole ISO 3166-1 alpha-2 list without duplicates", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    expect(isCountryCode("BY")).toBe(true);
    expect(isCountryCode("KZ")).toBe(true);
    expect(isCountryCode("XK")).toBe(false);
  });

  it("accepts a full set of profile fields", () => {
    const parsed = profileUpdateBodySchema.safeParse({
      birthDay: 29,
      birthMonth: 2,
      gender: "FEMALE",
      country: "BY",
      about: "Люблю книги и прогулки.",
      profileVisibleToFriends: false,
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts an empty body and explicit nulls as 'no value'", () => {
    expect(profileUpdateBodySchema.safeParse({}).success).toBe(true);
    expect(
      profileUpdateBodySchema.safeParse({
        birthDay: null,
        birthMonth: null,
        gender: null,
        country: null,
        about: null,
      }).success,
    ).toBe(true);
  });

  it("rejects unknown keys, including a year", () => {
    expect(profileUpdateBodySchema.safeParse({ birthYear: 1990 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ name: "Анна" }).success).toBe(false);
  });

  it("keeps the birthday day in 1..31 and the month in 1..12", () => {
    expect(profileUpdateBodySchema.safeParse({ birthDay: 1, birthMonth: 1 }).success).toBe(true);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 31, birthMonth: 1 }).success).toBe(true);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 31, birthMonth: 12 }).success).toBe(true);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 0, birthMonth: 1 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 32, birthMonth: 1 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 1, birthMonth: 0 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 1, birthMonth: 13 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 1.5, birthMonth: 1 }).success).toBe(false);
  });

  it("accepts a real calendar day and refuses 30 February, allowing 29 February", () => {
    expect(profileUpdateBodySchema.safeParse({ birthDay: 30, birthMonth: 2 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 29, birthMonth: 2 }).success).toBe(true);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 31, birthMonth: 4 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 31, birthMonth: 11 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 30, birthMonth: 4 }).success).toBe(true);
    expect(isValidBirthDate(29, 2)).toBe(true);
    expect(isValidBirthDate(30, 2)).toBe(false);
  });

  it("refuses half a birthday: the pair is set or cleared together", () => {
    expect(profileUpdateBodySchema.safeParse({ birthDay: 5 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthMonth: 5 }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthDay: 5, birthMonth: null }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ birthDay: null, birthMonth: 5 }).success).toBe(false);
  });

  it("reports the birthday pair on the birthDay field", () => {
    const parsed = profileUpdateBodySchema.safeParse({ birthDay: 5 });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["birthDay"]);
  });

  it("caps «Обо мне» at 500 characters after trimming and clears an empty text", () => {
    const atCap = profileUpdateBodySchema.parse({ about: "я".repeat(ABOUT_MAX) });
    expect(atCap.about).toHaveLength(ABOUT_MAX);
    expect(profileUpdateBodySchema.safeParse({ about: "я".repeat(ABOUT_MAX + 1) }).success).toBe(false);
    // Spaces around the text do not count against the cap.
    expect(
      profileUpdateBodySchema.safeParse({ about: `  ${"я".repeat(ABOUT_MAX)}  ` }).success,
    ).toBe(true);
    expect(profileUpdateBodySchema.parse({ about: "   " }).about).toBeNull();
    expect(profileUpdateBodySchema.parse({ about: "" }).about).toBeNull();
  });

  it("normalizes the country to the upper-case code and refuses values outside ISO", () => {
    expect(profileUpdateBodySchema.parse({ country: "by" }).country).toBe("BY");
    expect(profileUpdateBodySchema.parse({ country: " by " }).country).toBe("BY");
    expect(profileUpdateBodySchema.parse({ country: "" }).country).toBeNull();
    expect(profileUpdateBodySchema.safeParse({ country: "XX" }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ country: "B" }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ country: "BLR" }).success).toBe(false);
  });

  it("accepts both genders and 'not specified', and refuses anything else", () => {
    expect(profileUpdateBodySchema.parse({ gender: "MALE" }).gender).toBe("MALE");
    expect(profileUpdateBodySchema.parse({ gender: "FEMALE" }).gender).toBe("FEMALE");
    expect(profileUpdateBodySchema.parse({ gender: null }).gender).toBeNull();
    expect(profileUpdateBodySchema.safeParse({ gender: "OTHER" }).success).toBe(false);
    expect(profileUpdateBodySchema.safeParse({ gender: "male" }).success).toBe(false);
  });

  it("keeps the visibility switch a boolean", () => {
    expect(profileUpdateBodySchema.safeParse({ profileVisibleToFriends: true }).success).toBe(true);
    expect(profileUpdateBodySchema.safeParse({ profileVisibleToFriends: "true" }).success).toBe(false);
  });

  it("describes the owner's answer with every field present", () => {
    const parsed = myProfileSchema.parse({
      id: "u1",
      email: "a@example.com",
      name: "Аня",
      nick: "anya",
      timeZone: null,
      hideFromSearch: false,
      birthDay: null,
      birthMonth: null,
      gender: null,
      country: null,
      about: null,
      profileVisibleToFriends: true,
    });

    expect(parsed.profileVisibleToFriends).toBe(true);
    expect(parsed).not.toHaveProperty("year");
  });
});
