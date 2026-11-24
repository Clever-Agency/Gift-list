import type { NotificationItem } from "../notifications";
import { getMessages } from "./messages";
import { negotiateLocale } from "./locale";

export function notificationChangedFields(event: NotificationItem["event"], locale: string): string | null {
  if (event.kind !== "GIFT_EDITED" || !event.fields.length) return null;
  const copy = getMessages(negotiateLocale([locale])).notifications;
  const fields = event.fields.map(field => copy.fields[field]).join(", ");
  return copy.changedFields.replace("{fields}", fields);
}

export function notificationText(event: NotificationItem["event"], locale: string) {
  const resolved = negotiateLocale([locale]);
  const copy = getMessages(resolved).common.notifications;
  const title = "titleSnapshot" in event ? event.titleSnapshot : "";
  const person = "personName" in event ? event.personName : "";
  let date = "date" in event ? event.date : "";
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
