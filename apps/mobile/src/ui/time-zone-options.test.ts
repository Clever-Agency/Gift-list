import { describe, expect, it } from "vitest";
import { timeZoneLabel, timeZoneOptions, timeZoneOffset } from "./time-zone-options";

/** A winter instant: Europe/Minsk is UTC+3 and Asia/Tokyo UTC+9 all year. */
const NOW = new Date("2026-11-27T12:00:00.000Z");

describe("timeZoneOffset", () => {
  it("writes the current offset as UTC+N", () => {
    expect(timeZoneOffset("Europe/Minsk", NOW)).toBe("UTC+3");
    expect(timeZoneOffset("Asia/Tokyo", NOW)).toBe("UTC+9");
  });

  it("keeps a half-hour zone", () => {
    expect(timeZoneOffset("Asia/Kolkata", NOW)).toBe("UTC+5:30");
  });

  it("does not double the zone name for UTC", () => {
    expect(timeZoneLabel("UTC", NOW)).toBe("UTC");
  });
});

describe("timeZoneOptions", () => {
  it("labels every zone with its offset and sorts by the visible name", () => {
    const options = timeZoneOptions(
      "Europe/Minsk",
      ["UTC", "Europe/Minsk", "Asia/Tokyo"],
      NOW,
    );

    expect(options.map((option) => option.value)).toEqual([
      "Asia/Tokyo",
      "Europe/Minsk",
      "UTC",
    ]);
    expect(options[1]?.label).toBe("Europe/Minsk (UTC+3)");
  });

  it("keeps the current zone when the runtime no longer lists it", () => {
    const options = timeZoneOptions(
      "America/Argentina/ComodRivadavia",
      ["UTC", "Asia/Tokyo"],
      NOW,
    );

    expect(options.map((option) => option.value)).toContain(
      "America/Argentina/ComodRivadavia",
    );
  });

  it("falls back to the current zone and UTC without Intl.supportedValuesOf", () => {
    const options = timeZoneOptions("Europe/Minsk", null, NOW);

    expect(options.map((option) => option.value)).toEqual(["Europe/Minsk", "UTC"]);
  });

  it("offers UTC alone when the zone is not set yet", () => {
    expect(timeZoneOptions(null, null, NOW)).toEqual([{ value: "UTC", label: "UTC" }]);
  });
});
