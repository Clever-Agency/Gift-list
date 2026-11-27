import app from "./ru/app.json";
import common from "./ru/common.json";
import notifications from "./ru/notifications.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./locale";

const { messages: notificationMessages, ...notificationUi } = notifications;

/**
 * Catalogs of the client apps. The Next-only `web` and `email` catalogs are not
 * here: they would ride in the SPA bundle of `apps/mobile` unused (the two labels
 * the shell needs live in `common`). Web pages and letters read `getWebMessages`
 * from `@gift-list/contracts/web-messages`.
 */
const catalogs = {
  ru: { common: { ...common, notifications: notificationMessages }, app, notifications: notificationUi },
} as const;

export type Messages = (typeof catalogs)[SupportedLocale];

/** Catalogs for a supported locale. Unknown locales receive `ru`. */
export function getMessages(locale: string = DEFAULT_LOCALE): Messages {
  if ((SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return catalogs[locale as SupportedLocale];
  }
  return catalogs[DEFAULT_LOCALE];
}
