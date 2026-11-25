import type { NotificationItem } from "../notifications";
import { RESERVATION_RELEASE_AFTER_MS } from "../notifications";
import { getMessages } from "./messages";
import { negotiateLocale } from "./locale";

/**
 * The same shape every notification date uses (Story 5.6 / CLE-124/S9b-2):
 * a localized day of the recipient's zone, without a year. `shiftMs` moves the
 * instant off the exclusive end of a calendar day (`−1` ms lands on the day
 * itself) or onto the release moment (`+168 ч`).
 */
function notificationDay(
  instant: string,
  timeZone: string,
  locale: string,
  shiftMs: number,
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(Date.parse(instant) + shiftMs));
}

export function notificationChangedFields(event: NotificationItem["event"], locale: string): string | null {
  if (event.kind !== "GIFT_EDITED" || !event.fields.length) return null;
  const copy = getMessages(negotiateLocale([locale])).notifications;
  const fields = event.fields.map(field => copy.fields[field]).join(", ");
  return copy.changedFields.replace("{fields}", fields);
}

export function notificationText(event: NotificationItem["event"], locale: string) {
  const resolved = negotiateLocale([locale]);
  const messages = getMessages(resolved);
  const copy = messages.common.notifications;
  const title = "titleSnapshot" in event ? event.titleSnapshot : "";
  const person = "personName" in event ? event.personName : "";
  let date = "date" in event ? event.date : "";

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
    date = new Intl.DateTimeFormat(resolved, {
      day: "numeric",
      month: "long",
      timeZone: event.timeZone,
    }).format(new Date(Date.parse(event.dueAt) - 1));
  }
  return copy[event.kind].replace(/\{(title|person|date)\}/g, function value(_, key: string) {
    if (key === "title") return title;
    if (key === "person") return person;
    return date;
  });
}
