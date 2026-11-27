import email from "./ru/email.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./locale";
import { getMessages, type Messages } from "./messages";

/**
 * Next-only catalog on top of the client messages: `email` (letters sent by
 * the server). It lives in a separate entry point on purpose: the SPA of
 * `apps/mobile` reads {@link getMessages} and never pays for the letters in the
 * web bundle (CLE-141/S0-1). `web` stays in the base catalog because the app
 * shell and the public gift card use it too.
 */
const catalogs = {
  ru: { ...getMessages("ru"), email },
} as const satisfies Record<SupportedLocale, Messages & { email: typeof email }>;

export type WebMessages = (typeof catalogs)[SupportedLocale];

/** Catalogs for a Next page or a letter; unknown locales receive `ru`. */
export function getWebMessages(locale: string = DEFAULT_LOCALE): WebMessages {
  if ((SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return catalogs[locale as SupportedLocale];
  }
  return catalogs[DEFAULT_LOCALE];
}
