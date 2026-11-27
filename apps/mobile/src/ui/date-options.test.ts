import { describe, expect, it } from "vitest";
import { dayOptions, monthOptions } from "@/ui/date-options";

function values(options: { value: string }[]): number[] {
  return options.map((option) => Number(option.value));
}

describe("monthOptions", () => {
  it("lists the twelve months in calendar order in the interface locale", () => {
    const months = monthOptions("ru");
    expect(months).toHaveLength(12);
    expect(months[0]?.label).toBe("январь");
    expect(months[11]?.label).toBe("декабрь");
  });
});

describe("dayOptions", () => {
  it("keeps 31 days while the month is not chosen", () => {
    expect(values(dayOptions(null))).toHaveLength(31);
  });

  it("never offers 30 February or 31 April", () => {
    expect(values(dayOptions(2))).toHaveLength(29);
    expect(values(dayOptions(4))).toHaveLength(30);
  });

  it("with a leap year February stops at 29, without one at 28", () => {
    expect(values(dayOptions(2, 2024))).toContain(29);
    expect(values(dayOptions(2, 2023))).not.toContain(29);
    expect(values(dayOptions(2, 2000))).toContain(29);
    expect(values(dayOptions(2, 1900))).not.toContain(29);
  });

  it("without a year 29 February stays available (AD-23)", () => {
    expect(values(dayOptions(2, null))).toContain(29);
  });
});
