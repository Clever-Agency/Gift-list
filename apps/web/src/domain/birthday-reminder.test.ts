import { describe, expect, it } from "vitest";
import {
  BIRTHDAY_FRIEND_REMINDER_DAYS,
  BIRTHDAY_OWN_REMINDER_DAYS,
  birthdayDayInYear,
  birthdayReminderYear,
  dueBirthdayReminderYear,
  isLeapYear,
  recipientLocalMoment,
} from "./birthday-reminder";

const MINSK = "Europe/Minsk"; // UTC+3 all year.

describe("Story 7.3/7.4: the recipient's local day and hour (AD-27)", () => {
  it("reads the local day and hour in the recipient's zone", () => {
    const now = new Date("2026-11-27T22:30:00.000Z");

    // Minsk is UTC+3: 01:30 on 28 November.
    expect(recipientLocalMoment(now, MINSK)).toEqual({ day: "2026-11-28", hour: 1 });
    // Kiritimati is UTC+14: 12:30 on 28 November.
    expect(recipientLocalMoment(now, "Pacific/Kiritimati")).toEqual({
      day: "2026-11-28",
      hour: 12,
    });
    // Los Angeles is UTC−8 in November: 14:30 on 27 November.
    expect(recipientLocalMoment(now, "America/Los_Angeles")).toEqual({
      day: "2026-11-27",
      hour: 14,
    });
  });

  it("falls back to UTC for a missing or unknown zone (Story 1.8)", () => {
    const now = new Date("2026-11-27T10:15:00.000Z");

    expect(recipientLocalMoment(now, null)).toEqual({ day: "2026-11-27", hour: 10 });
    expect(recipientLocalMoment(now, "Not/AZone")).toEqual({ day: "2026-11-27", hour: 10 });
  });
});

describe("Story 7.1/7.3: the birthday day of a year, 29 February included", () => {
  it("keeps 29 February in a leap year", () => {
    expect(isLeapYear(2028)).toBe(true);
    expect(birthdayDayInYear(29, 2, 2028)).toBe("2028-02-29");
  });

  it("observes 29 February on 28 February in a non-leap year", () => {
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(birthdayDayInYear(29, 2, 2026)).toBe("2026-02-28");
  });

  it("keeps every other day and month as stored", () => {
    expect(birthdayDayInYear(14, 11, 2026)).toBe("2026-11-14");
    expect(birthdayDayInYear(1, 1, 2027)).toBe("2027-01-01");
    expect(birthdayDayInYear(31, 12, 2026)).toBe("2026-12-31");
  });
});

describe("Story 7.3: «до дня рождения друга 14 дней»", () => {
  it("matches the day exactly 14 days before the birthday", () => {
    // 14 November minus 14 days is 31 October.
    expect(
      birthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-10-31T10:00:00.000Z"), MINSK),
    ).toBe(2026);
  });

  it("does not match a day before or after the reminder day", () => {
    expect(
      birthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-10-30T10:00:00.000Z"), MINSK),
    ).toBeNull();
    expect(
      birthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-11-01T10:00:00.000Z"), MINSK),
    ).toBeNull();
  });

  it("reads the day on the recipient's local date, not UTC", () => {
    const now = new Date("2026-10-31T21:30:00.000Z");

    // Minsk already reads 1 November 00:30 — the reminder day is over there.
    expect(birthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, now, MINSK)).toBeNull();
    // Los Angeles still reads 31 October 14:30 — the reminder day is here.
    expect(
      birthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, now, "America/Los_Angeles"),
    ).toBe(2026);
  });

  it("crosses the year end and answers the birthday year, not the local one", () => {
    // 18 December 2026 + 14 days = 1 January 2027.
    expect(
      birthdayReminderYear(1, 1, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-12-18T10:00:00.000Z"), MINSK),
    ).toBe(2027);
    // 31 December 2026 + 14 days = 14 January 2027 — nobody has a birthday that day.
    expect(
      birthdayReminderYear(1, 1, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-12-31T10:00:00.000Z"), MINSK),
    ).toBeNull();
  });

  it("counts 29 February as 28 February in a non-leap year", () => {
    // 28 February 2026 minus 14 days is 14 February 2026.
    expect(
      birthdayReminderYear(29, 2, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-02-14T10:00:00.000Z"), MINSK),
    ).toBe(2026);
    // 1 March 2026 is not the reminder day; 28 February is already today.
    expect(
      birthdayReminderYear(29, 2, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-02-15T10:00:00.000Z"), MINSK),
    ).toBeNull();
  });

  it("uses the real 29 February in a leap year", () => {
    // 29 February 2028 minus 14 days is 15 February 2028.
    expect(
      birthdayReminderYear(29, 2, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2028-02-15T10:00:00.000Z"), MINSK),
    ).toBe(2028);
    // 14 February 2028 would be 15 days before the real birthday.
    expect(
      birthdayReminderYear(29, 2, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2028-02-14T10:00:00.000Z"), MINSK),
    ).toBeNull();
  });
});

describe("Story 7.4: «до своего дня рождения 30 дней»", () => {
  it("matches the day exactly 30 days before the birthday", () => {
    // 14 November minus 30 days is 15 October.
    expect(
      birthdayReminderYear(14, 11, BIRTHDAY_OWN_REMINDER_DAYS, new Date("2026-10-15T10:00:00.000Z"), MINSK),
    ).toBe(2026);
  });

  it("crosses the year end and answers the birthday year", () => {
    // 2 December 2026 + 30 days = 1 January 2027.
    expect(
      birthdayReminderYear(1, 1, BIRTHDAY_OWN_REMINDER_DAYS, new Date("2026-12-02T10:00:00.000Z"), MINSK),
    ).toBe(2027);
  });

  it("counts 29 February as 28 February in a non-leap year", () => {
    // 28 February 2026 minus 30 days is 29 January 2026.
    expect(
      birthdayReminderYear(29, 2, BIRTHDAY_OWN_REMINDER_DAYS, new Date("2026-01-29T10:00:00.000Z"), MINSK),
    ).toBe(2026);
  });
});

describe("Story 7.3/7.4: «пора слать» — the reminder day from 10:00 local time", () => {
  it("is due from 10:00 on the recipient's reminder day", () => {
    const birthday = { day: 14, month: 11 };

    // 10:00 and 23:59 in Minsk (UTC+3) on 31 October.
    expect(
      dueBirthdayReminderYear(birthday.day, birthday.month, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-10-31T07:00:00.000Z"), MINSK),
    ).toBe(2026);
    expect(
      dueBirthdayReminderYear(birthday.day, birthday.month, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-10-31T20:59:00.000Z"), MINSK),
    ).toBe(2026);
  });

  it("is not due at 09:59 local time", () => {
    expect(
      dueBirthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-10-31T06:59:00.000Z"), MINSK),
    ).toBeNull();
    expect(
      dueBirthdayReminderYear(14, 11, BIRTHDAY_OWN_REMINDER_DAYS, new Date("2026-10-15T06:59:00.000Z"), MINSK),
    ).toBeNull();
  });

  it("is not due after the local day has turned", () => {
    // Midnight on 1 November in Minsk.
    expect(
      dueBirthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-10-31T21:00:00.000Z"), MINSK),
    ).toBeNull();
  });

  it("uses UTC when the recipient's zone is missing or unknown", () => {
    const now = new Date("2026-10-31T10:00:00.000Z");

    expect(dueBirthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, now, null)).toBe(2026);
    expect(dueBirthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, now, "Not/AZone")).toBe(2026);
    expect(
      dueBirthdayReminderYear(14, 11, BIRTHDAY_FRIEND_REMINDER_DAYS, new Date("2026-10-31T09:59:00.000Z"), null),
    ).toBeNull();
  });
});
