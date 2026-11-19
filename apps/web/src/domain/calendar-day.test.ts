import { describe, expect, it } from "vitest";
import {
  calendarDay,
  isBeforeLocalToday,
  isCalendarDay,
  localCalendarDay,
} from "./calendar-day";

describe("localCalendarDay", () => {
  it("uses UTC when the zone is missing or not an IANA name", () => {
    const now = new Date("2026-11-10T23:30:00.000Z");
    expect(localCalendarDay(now, null)).toBe("2026-11-10");
    expect(localCalendarDay(now, "Not/AZone")).toBe("2026-11-10");
  });

  it("follows the owner's zone across midnight", () => {
    const now = new Date("2026-11-10T22:00:00.000Z");
    expect(localCalendarDay(now, "UTC")).toBe("2026-11-10");
    expect(localCalendarDay(now, "Europe/Minsk")).toBe("2026-11-11");
  });
});

describe("isBeforeLocalToday", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");

  it("keeps today and rejects an earlier day", () => {
    expect(isBeforeLocalToday("2026-11-10", now, "UTC")).toBe(false);
    expect(isBeforeLocalToday("2026-11-09", now, "UTC")).toBe(true);
    expect(isBeforeLocalToday("2026-11-11", now, "UTC")).toBe(false);
  });
});

describe("isCalendarDay", () => {
  it("accepts a real day and rejects an impossible one", () => {
    expect(isCalendarDay("2026-12-31")).toBe(true);
    expect(isCalendarDay("2026-02-31")).toBe(false);
    expect(calendarDay(new Date("2026-12-31T00:00:00.000Z"))).toBe("2026-12-31");
  });
});
