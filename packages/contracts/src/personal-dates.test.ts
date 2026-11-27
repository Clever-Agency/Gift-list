// CLE-141 (Story 7.5, AD-23): personal date contract — title, the real calendar
// day, the optional year, the two visibility switches and the two answers.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATE_VISIBILITY,
  DEFAULT_DATE_YEAR_VISIBILITY,
  PERSONAL_DATES_MAX,
  PERSONAL_DATE_MIN_YEAR,
  PERSONAL_DATE_TITLE_MAX,
  isPersonalDateYearAllowed,
  isValidPersonalDate,
  personalDateCreateBodySchema,
  personalDateSchema,
  personalDateUpdateBodySchema,
  visiblePersonalDateSchema,
} from "./index";

const FUTURE_YEAR = new Date().getUTCFullYear() + 1;
const CURRENT_YEAR = new Date().getUTCFullYear();

function createBody(overrides: Record<string, unknown> = {}) {
  return { title: "Годовщина", day: 14, month: 6, ...overrides };
}

describe("personal date constants (CLE-141, AD-23)", () => {
  it("keeps the caps from the story: 40 characters, 10 dates, year from 1900", () => {
    expect(PERSONAL_DATE_TITLE_MAX).toBe(40);
    expect(PERSONAL_DATES_MAX).toBe(10);
    expect(PERSONAL_DATE_MIN_YEAR).toBe(1900);
  });

  it("defaults to «друзья» for the date and «только я» for the year", () => {
    expect(DEFAULT_DATE_VISIBILITY).toBe("FRIENDS");
    expect(DEFAULT_DATE_YEAR_VISIBILITY).toBe("ONLY_ME");
  });
});

describe("isValidPersonalDate — день и месяц (AD-23)", () => {
  it("refuses a day that does not exist in the month", () => {
    expect(isValidPersonalDate(31, 4)).toBe(false);
    expect(isValidPersonalDate(31, 6)).toBe(false);
    expect(isValidPersonalDate(31, 11)).toBe(false);
    expect(isValidPersonalDate(30, 2)).toBe(false);
    expect(isValidPersonalDate(29, 2)).toBe(true);
    expect(isValidPersonalDate(31, 1)).toBe(true);
    expect(isValidPersonalDate(30, 4)).toBe(true);
  });

  it("refuses a day or a month outside its range", () => {
    expect(isValidPersonalDate(0, 1)).toBe(false);
    expect(isValidPersonalDate(32, 1)).toBe(false);
    expect(isValidPersonalDate(1, 0)).toBe(false);
    expect(isValidPersonalDate(1, 13)).toBe(false);
    expect(isValidPersonalDate(1.5, 1)).toBe(false);
  });

  it("uses the leap rule when a year is stored", () => {
    expect(isValidPersonalDate(29, 2, 2024)).toBe(true);
    expect(isValidPersonalDate(29, 2, 2023)).toBe(false);
    expect(isValidPersonalDate(29, 2, 1900)).toBe(false);
    expect(isValidPersonalDate(29, 2, 2000)).toBe(true);
    expect(isValidPersonalDate(29, 2, null)).toBe(true);
  });
});

describe("isPersonalDateYearAllowed — год не из будущего (AD-23)", () => {
  const now = new Date(Date.UTC(2026, 10, 27));

  it("accepts 1900 and the current year, and refuses the future", () => {
    expect(isPersonalDateYearAllowed(1900, now)).toBe(true);
    expect(isPersonalDateYearAllowed(2026, now)).toBe(true);
    expect(isPersonalDateYearAllowed(2027, now)).toBe(false);
    expect(isPersonalDateYearAllowed(1899, now)).toBe(false);
  });
});

describe("personalDateCreateBodySchema — создание (Story 7.5)", () => {
  it("accepts the whole body and fills both visibility defaults", () => {
    const parsed = personalDateCreateBodySchema.parse({
      title: "Годовщина",
      day: 14,
      month: 6,
      year: 2020,
    });

    expect(parsed).toEqual({
      title: "Годовщина",
      day: 14,
      month: 6,
      year: 2020,
      visibility: "FRIENDS",
      yearVisibility: "ONLY_ME",
    });
  });

  it("accepts a date without a year and both explicit switches", () => {
    const parsed = personalDateCreateBodySchema.parse(
      createBody({ year: null, visibility: "EVERYONE", yearVisibility: "FRIENDS" }),
    );

    expect(parsed.year).toBeNull();
    expect(parsed.visibility).toBe("EVERYONE");
    expect(parsed.yearVisibility).toBe("FRIENDS");
  });

  it("trims the title and caps it at 40 characters", () => {
    expect(personalDateCreateBodySchema.parse(createBody({ title: "  Дата  " })).title).toBe("Дата");
    expect(
      personalDateCreateBodySchema.safeParse(
        createBody({ title: "я".repeat(PERSONAL_DATE_TITLE_MAX) }),
      ).success,
    ).toBe(true);
    expect(
      personalDateCreateBodySchema.safeParse(
        createBody({ title: "я".repeat(PERSONAL_DATE_TITLE_MAX + 1) }),
      ).success,
    ).toBe(false);
  });

  it("refuses an empty title, a title of spaces and NUL", () => {
    expect(personalDateCreateBodySchema.safeParse(createBody({ title: "" })).success).toBe(false);
    expect(personalDateCreateBodySchema.safeParse(createBody({ title: "   " })).success).toBe(false);
    expect(
      personalDateCreateBodySchema.safeParse(createBody({ title: "Дата\u0000" })).success,
    ).toBe(false);
    expect(personalDateCreateBodySchema.safeParse(createBody({ title: undefined })).success).toBe(
      false,
    );
  });

  it("refuses 31 April and 30 February and accepts 29 February", () => {
    expect(personalDateCreateBodySchema.safeParse(createBody({ day: 31, month: 4 })).success).toBe(
      false,
    );
    expect(personalDateCreateBodySchema.safeParse(createBody({ day: 30, month: 2 })).success).toBe(
      false,
    );
    expect(personalDateCreateBodySchema.safeParse(createBody({ day: 29, month: 2 })).success).toBe(
      true,
    );
  });

  it("checks 29 February against the stored year", () => {
    expect(
      personalDateCreateBodySchema.safeParse(createBody({ day: 29, month: 2, year: 2024 })).success,
    ).toBe(true);
    expect(
      personalDateCreateBodySchema.safeParse(createBody({ day: 29, month: 2, year: 2023 })).success,
    ).toBe(false);
  });

  it("reports the calendar issue on the day field", () => {
    const parsed = personalDateCreateBodySchema.safeParse(createBody({ day: 31, month: 4 }));

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["day"]);
  });

  it("refuses a year in the future and below 1900", () => {
    expect(personalDateCreateBodySchema.safeParse(createBody({ year: FUTURE_YEAR })).success).toBe(
      false,
    );
    expect(personalDateCreateBodySchema.safeParse(createBody({ year: CURRENT_YEAR })).success).toBe(
      true,
    );
    expect(personalDateCreateBodySchema.safeParse(createBody({ year: 1899 })).success).toBe(false);
    expect(personalDateCreateBodySchema.safeParse(createBody({ year: 1900 })).success).toBe(true);
  });

  it("reports the future year on the year field", () => {
    const parsed = personalDateCreateBodySchema.safeParse(createBody({ year: FUTURE_YEAR }));

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["year"]);
  });

  it("stays a closed set: no id, no owner, no other visibility value", () => {
    expect(personalDateCreateBodySchema.safeParse(createBody({ id: "d1" })).success).toBe(false);
    expect(personalDateCreateBodySchema.safeParse(createBody({ userId: "u1" })).success).toBe(false);
    expect(
      personalDateCreateBodySchema.safeParse(createBody({ visibility: "PUBLIC" })).success,
    ).toBe(false);
    expect(
      personalDateCreateBodySchema.safeParse(createBody({ yearVisibility: "SECRET" })).success,
    ).toBe(false);
  });
});

describe("personalDateUpdateBodySchema — правка (Story 7.5)", () => {
  it("accepts a partial body and keeps absent keys absent", () => {
    const parsed = personalDateUpdateBodySchema.parse({ title: "Новая дата" });

    expect(parsed).toEqual({ title: "Новая дата" });
  });

  it("refuses an empty body", () => {
    expect(personalDateUpdateBodySchema.safeParse({}).success).toBe(false);
  });

  it("changes day and month together", () => {
    expect(personalDateUpdateBodySchema.safeParse({ day: 5 }).success).toBe(false);
    expect(personalDateUpdateBodySchema.safeParse({ month: 5 }).success).toBe(false);
    expect(
      personalDateUpdateBodySchema.safeParse({ day: 5, month: 5 }).success,
    ).toBe(true);
  });

  it("checks the calendar of the new day and month", () => {
    expect(personalDateUpdateBodySchema.safeParse({ day: 31, month: 4 }).success).toBe(false);
    expect(personalDateUpdateBodySchema.safeParse({ day: 29, month: 2 }).success).toBe(true);
    expect(
      personalDateUpdateBodySchema.safeParse({ day: 29, month: 2, year: 2023 }).success,
    ).toBe(false);
  });

  it("clears the year with null and refuses a future one", () => {
    expect(personalDateUpdateBodySchema.parse({ year: null }).year).toBeNull();
    expect(personalDateUpdateBodySchema.safeParse({ year: FUTURE_YEAR }).success).toBe(false);
    expect(personalDateUpdateBodySchema.safeParse({ year: 1899 }).success).toBe(false);
  });

  it("validates a year-only body against the range, not against the stored day", () => {
    // A day is not in the body, so the stored month is unknown here; the server
    // re-checks 29 February with a non-leap year on the merged row.
    expect(personalDateUpdateBodySchema.safeParse({ year: 2023 }).success).toBe(true);
  });

  it("changes each visibility switch on its own", () => {
    expect(personalDateUpdateBodySchema.parse({ visibility: "EVERYONE" }).visibility).toBe(
      "EVERYONE",
    );
    expect(personalDateUpdateBodySchema.parse({ yearVisibility: "FRIENDS" }).yearVisibility).toBe(
      "FRIENDS",
    );
    expect(personalDateUpdateBodySchema.safeParse({ visibility: "PUBLIC" }).success).toBe(false);
  });

  it("stays a closed set", () => {
    expect(personalDateUpdateBodySchema.safeParse({ id: "d1" }).success).toBe(false);
    expect(personalDateUpdateBodySchema.safeParse({ ownerId: "u1" }).success).toBe(false);
  });
});

describe("personal date answers (AD-23)", () => {
  const own = {
    id: "d1",
    kind: "CUSTOM",
    title: "Годовщина",
    day: 14,
    month: 6,
    year: 2020,
    visibility: "FRIENDS",
    yearVisibility: "ONLY_ME",
  } as const;

  it("the owner's row carries both switches and every stored field", () => {
    expect(personalDateSchema.parse(own)).toEqual(own);
  });

  it("the owner's row refuses a free kind and an unknown visibility", () => {
    expect(personalDateSchema.safeParse({ ...own, kind: "BIRTHDAY" }).success).toBe(false);
    expect(personalDateSchema.safeParse({ ...own, visibility: "PUBLIC" }).success).toBe(false);
    expect(personalDateSchema.safeParse({ ...own, extra: true }).success).toBe(false);
  });

  it("a viewer's row has no visibility switches and keeps the year key", () => {
    const { visibility, yearVisibility, ...visible } = own;

    expect(visibility).toBe("FRIENDS");
    expect(yearVisibility).toBe("ONLY_ME");
    expect(visiblePersonalDateSchema.parse(visible)).toEqual(visible);
    expect(visiblePersonalDateSchema.safeParse(own).success).toBe(false);
  });

  it("a viewer's row accepts a hidden year as null", () => {
    const visible = {
      id: "d1",
      kind: "CUSTOM",
      title: "Годовщина",
      day: 14,
      month: 6,
      year: null,
    };

    expect(visiblePersonalDateSchema.parse(visible)).toEqual(visible);
  });
});
