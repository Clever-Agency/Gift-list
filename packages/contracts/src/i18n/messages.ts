import app from "./ru/app.json";
import common from "./ru/common.json";
import notifications from "./ru/notifications.json";
import web from "./ru/web.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./locale";

const { messages: notificationMessages, ...notificationUi } = notifications;

/**
 * Catalogs of the client apps. The Next-only `email` catalog is not here: it
 * would ride in the SPA bundle of `apps/mobile` unused. Web pages and letters
 * read `getWebMessages` from `@gift-list/contracts/web-messages`.
 */
const catalogs = {
  ru: { common: { ...common, notifications: notificationMessages }, app, web, notifications: notificationUi },
} as const;

export type Messages = (typeof catalogs)[SupportedLocale];

/** Catalogs for a supported locale. Unknown locales receive `ru`. */
export function getMessages(locale: string = DEFAULT_LOCALE): Messages {
  if ((SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return catalogs[locale as SupportedLocale];
  }
  return catalogs[DEFAULT_LOCALE];
}
