import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calendarDayInZone,
  isDueOnInRange,
  maxReserveDueOn,
  minReserveDueOn,
  reservationDueAtFromDueOn,
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
  });

  it("stores the first instant of the day after the chosen due day", () => {
    const dueOn = "2026-06-20";
    const dueAt = reservationDueAtFromDueOn(dueOn, zone);
    expect(calendarDayInZone(dueAt, zone)).toBe("2026-06-21");
    expect(dueAt).toEqual(startOfCalendarDayInZone("2026-06-21", zone));
  });
});