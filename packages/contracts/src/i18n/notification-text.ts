import type { NotificationItem } from "../notifications";
import { RESERVATION_RELEASE_AFTER_MS } from "../notifications";
import { formatDate, formatDay } from "./format";
import { getMessages } from "./messages";
import { negotiateLocale } from "./locale";

/**
 * The same shape every notification date uses (Story 5.6 / CLE-124/S9c): a
 * localized day of the recipient's zone in words, without a year. `shiftMs`
 * moves the instant off the exclusive end of a calendar day (`−1` ms lands on
 * the day itself) or onto the release moment (`+168 ч`).
 */
function notificationDay(
  instant: string,
  timeZone: string,
  locale: string,
  shiftMs: number,
): string {
  return formatDay(new Date(Date.parse(instant) + shiftMs), locale, timeZone);
}

export function notificationChangedFields(event: NotificationItem["event"], locale: string): string | null {
  if (event.kind !== "GIFT_EDITED" || !event.fields.length) return null;
  const copy = getMessages(negotiateLocale([locale])).notifications;
  const fields = event.fields.map(field => copy.fields[field]).join(", ");
  return copy.changedFields.replace("{fields}", fields);
}

/**
 * Story 7.3 (FR-34): the birthday notice names the day without a year. The
 * stored `date` is a date-only value (`YYYY-MM-DD`), so `formatDate` keeps the
 * calendar day in every zone (AD-27).
 */
function notificationDate(event: NotificationItem["event"], locale: string): string {
  return event.kind === "DATE_FRIEND" ? formatDate(event.date, locale, { year: false }) : "";
}

/**
 * Story 7.3 (FR-34): the extra lines of a birthday notice — how many open
 * wishes the recipient can reserve and up to three of their titles. Rows
 * written before the summary existed simply have no extra lines.
 */
export function notificationDetails(event: NotificationItem["event"], locale: string): string[] {
  if (event.kind !== "DATE_FRIEND") return [];
  const copy = getMessages(negotiateLocale([locale])).notifications;
  const lines: string[] = [];
  if (event.count !== undefined) {
    lines.push(copy.dateFriendWishes.replace("{count}", String(event.count)));
  }
  const titles = event.titles?.slice(0, 3) ?? [];
  if (titles.length) {
    lines.push(copy.dateFriendTitles.replace("{titles}", titles.join("», «")));
  }
  return lines;
}

export function notificationText(event: NotificationItem["event"], locale: string) {
  const resolved = negotiateLocale([locale]);
  const messages = getMessages(resolved);
  const copy = messages.common.notifications;
  const title = "titleSnapshot" in event ? event.titleSnapshot : "";
  const person = "personName" in event ? event.personName : "";
  let date = notificationDate(event, resolved);

  // CLE-124/S9b-2: both reservation-deadline texts name a date. The expiry
  // notice says when the reservation is released (`Срок + 7 дней`, the same
  // window the timer uses); the reminder says when the deadline is.
  if (event.kind === "RESERVATION_DUE" && event.dueAt !== undefined && event.timeZone !== undefined) {
    if (event.reminder === true) {
      date = notificationDay(event.dueAt, event.timeZone, resolved, -1);
      return messages.notifications.dueReminder.replace(/\{(title|date)\}/g, function value(_, key: string) {
        return key === "title" ? title : date;
      });
    }
    const releaseDate = notificationDay(
      event.dueAt,
      event.timeZone,
      resolved,
      RESERVATION_RELEASE_AFTER_MS,
    );
    return messages.notifications.dueExpired.replace(/\{(title|releaseDate)\}/g, function value(_, key: string) {
      if (key === "releaseDate") return releaseDate;
      return title;
    });
  }

  if (event.kind === "RESERVATION_KEPT_BY_OWNER") {
    date = notificationDay(event.dueAt, event.timeZone, resolved, -1);
  }
  // Story 6.6: the kept-reservation variant suggests «Подарил», while the
  // released one only states that the reservation was cleared. A row written
  // before the flag existed reads as released.
  const template = event.kind === "WISH_EXPIRY" && event.released === false
    ? messages.notifications.wishExpiryKept
    : copy[event.kind];
  return template.replace(/\{(title|person|date)\}/g, function value(_, key: string) {
    if (key === "title") return title;
    if (key === "person") return person;
    return date;
  });
}

/**
 * Story 6.6: the letter subject names the wish-expiry kind in the recipient's
 * language. Every other kind keeps the general subject, so no new key is needed.
 * The caller substitutes `{brand}` with the displayed product name (AD-24).
 */
export function notificationEmailSubject(event: NotificationItem["event"], locale: string): string {
  const resolved = negotiateLocale([locale]);
  const copy = getMessages(resolved).notifications;
  if (event.kind === "WISH_EXPIRY_SOON") return copy.emailSubjectWishExpirySoon;
  if (event.kind === "WISH_EXPIRY") return copy.emailSubjectWishExpiry;
  if (event.kind === "DATE_FRIEND") {
    return copy.emailSubjectDateFriend
      .replace("{person}", event.personName)
      .replace("{date}", formatDate(event.date, resolved, { year: false }));
  }
  return copy.emailSubject;
}
