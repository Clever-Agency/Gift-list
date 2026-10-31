/** AD-27: locale negotiation lives in contracts, with no React and no env. */

export const SUPPORTED_LOCALES = ["ru"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "ru";

/** Match a language subtag against {@link SUPPORTED_LOCALES}; otherwise `ru`. */
export function negotiateLocale(preferred: readonly string[]): SupportedLocale {
  for (const tag of preferred) {
    const subtag = tag.split("-")[0]?.toLowerCase();
    if (subtag && (SUPPORTED_LOCALES as readonly string[]).includes(subtag)) {
      return subtag as SupportedLocale;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Ordered language tags from an `Accept-Language` header.
 * `null` and an empty header yield `[]` so {@link negotiateLocale} falls back to `ru`.
 */
export function preferredFromAcceptLanguage(header: string | null): string[] {
  if (header == null || header.trim() === "") return [];

  const parsed: { tag: string; q: number; index: number }[] = [];
  header.split(",").forEach((part, index) => {
    const [rawTag, ...params] = part.trim().split(";");
    const tag = rawTag?.trim() ?? "";
    if (tag === "" || tag === "*") return;

    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key?.trim() === "q") {
        const parsedQ = Number(value);
        if (!Number.isNaN(parsedQ)) q = parsedQ;
      }
    }
    if (q <= 0) return;
    parsed.push({ tag, q, index });
  });

  parsed.sort((left, right) => right.q - left.q || left.index - right.index);
  return parsed.map((item) => item.tag);
}
