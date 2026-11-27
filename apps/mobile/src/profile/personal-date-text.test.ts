import { describe, expect, it } from "vitest";
import { personalDateText, personalDateValue } from "@/profile/personal-date-text";

describe("personalDateValue", () => {
  it("builds the calendar value with the year when it is set", () => {
    expect(personalDateValue({ day: 2, month: 9, year: 1958 })).toBe("1958-09-02");
  });

  it("uses a stand-in year when the date has none", () => {
    expect(personalDateValue({ day: 14, month: 3, year: null })).toBe("2000-03-14");
  });
});

describe("personalDateText", () => {
  it("prints DD.MM without a year when the date has none (Story 7.5)", () => {
    expect(personalDateText({ day: 14, month: 3, year: null }, "ru")).toBe("14.03");
  });

  it("keeps the year when it is set", () => {
    expect(personalDateText({ day: 2, month: 9, year: 1958 }, "ru")).toBe("02.09.1958");
  });
});
