import email from "./ru/email.json";
import web from "./ru/web.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./locale";
import { getMessages, type Messages } from "./messages";

/**
 * Next-only catalogs on top of the client messages: `web` (the public pages of
 * `apps/web`) and `email` (the letters sent by the server). They live in a
 * separate entry point on purpose: the SPA of `apps/mobile` reads
 * {@link getMessages} and never pays for them in the web bundle (CLE-141/S0-1).
 * The two labels the app shell shares with the web pages live in `common`.
 */
const catalogs = {
  ru: { ...getMessages("ru"), web, email },
} as const satisfies Record<SupportedLocale, Messages & { web: typeof web; email: typeof email }>;

export type WebMessages = (typeof catalogs)[SupportedLocale];

/** Catalogs for a Next page or a letter; unknown locales receive `ru`. */
export function getWebMessages(locale: string = DEFAULT_LOCALE): WebMessages {
  if ((SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return catalogs[locale as SupportedLocale];
  }
  return catalogs[DEFAULT_LOCALE];
}
