import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calendarDayInZone,
  isDueOnInRange,
  maxReserveDueOn,
  minReserveDueOn,
  reservationDueAtFromDueOn,
  reservationDueOn,
  startOfCalendarDayInZone,
} from "./reservation-due";

describe("reservation due calendar rules", () => {
  const zone = "Europe/Moscow";
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("accepts a due day inside today…today+30", () => {
    const due = addCalendarDays(minReserveDueOn(zone, now), 7);
    expect(isDueOnInRange(due, zone, now)).toBe(true);
    expect(isDueOnInRange(maxReserveDueOn(zone, now), zone, now)).toBe(true);
    expect(isDueOnInRange(addCalendarDays(maxReserveDueOn(zone, now), 1), zone, now)).toBe(
      false,
    );
    expect(isDueOnInRange("2026-06-31", zone, now)).toBe(false);
  });

  it("stores the first instant of the day after the chosen due day", () => {
    const dueOn = "2026-06-20";
    const dueAt = reservationDueAtFromDueOn(dueOn, zone);
    expect(calendarDayInZone(dueAt, zone)).toBe("2026-06-21");
    expect(dueAt).toEqual(startOfCalendarDayInZone("2026-06-21", zone));
  });

  /** Story 5.5: the stored exclusive end of the day reads back as the picked day. */
  it("reads the picked day back from the exclusive end of that day", () => {
    const dueAt = reservationDueAtFromDueOn("2026-12-08", zone);

    expect(dueAt.toISOString()).toBe("2026-12-08T21:00:00.000Z");
    expect(reservationDueOn(dueAt, zone)).toBe("2026-12-08");
  });

  it("keeps the day in the snapshot zone even when UTC has already moved on", () => {
    // 2026-12-09 00:00 in Moscow is still 2026-12-08 in UTC.
    const dueAt = new Date("2026-12-08T21:00:00.000Z");

    expect(reservationDueOn(dueAt, "Europe/Moscow")).toBe("2026-12-08");
    expect(reservationDueOn(dueAt, "UTC")).toBe("2026-12-07");
  });

  it("reads a UTC end of day as the previous calendar day", () => {
    expect(reservationDueOn(new Date("2026-12-09T00:00:00.000Z"), "UTC")).toBe("2026-12-08");
  });
});