import app from "./ru/app.json";
import common from "./ru/common.json";
import email from "./ru/email.json";
import web from "./ru/web.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./locale";

const catalogs = {
  ru: { common, app, web, email },
} as const;

export type Messages = (typeof catalogs)[SupportedLocale];

/** Catalogs for a supported locale. Unknown locales receive `ru`. */
export function getMessages(locale: string = DEFAULT_LOCALE): Messages {
  if ((SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return catalogs[locale as SupportedLocale];
  }
  return catalogs[DEFAULT_LOCALE];
}
