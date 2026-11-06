import {
  DEFAULT_LOCALE,
  negotiateLocale,
  preferredFromAcceptLanguage,
  type SupportedLocale,
} from "@gift-list/contracts";

/**
 * AD-27: the request language of a public Next page. The proxy sets the header
 * only for `/l/*`, so every other route (including the Russian-only admin) keeps
 * the default `<html lang>` and does not vary by `Accept-Language`.
 */
export const PUBLIC_LOCALE_HEADER = "x-gift-list-locale";

/** The negotiated language of a request, `ru` when nothing supported matches. */
export function requestLocale(acceptLanguage: string | null): SupportedLocale {
  return negotiateLocale(preferredFromAcceptLanguage(acceptLanguage));
}

/**
 * The language of the document for this request. Without the proxy header this
 * is the default, so routes outside `/l` never inherit a visitor's language.
 */
export function pageLocale(headers: { get(name: string): string | null }): SupportedLocale {
  const publicLocale = headers.get(PUBLIC_LOCALE_HEADER);
  if (publicLocale === null) return DEFAULT_LOCALE;
  return negotiateLocale([publicLocale]);
}
