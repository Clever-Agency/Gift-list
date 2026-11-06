import { describe, expect, it } from "vitest";
import { pageLocale, requestLocale, PUBLIC_LOCALE_HEADER } from "./request-locale";

describe("requestLocale", () => {
  it("negotiates ru from Accept-Language and falls back to ru", () => {
    expect(requestLocale("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(requestLocale("en-US,en;q=0.9")).toBe("ru");
    expect(requestLocale(null)).toBe("ru");
  });
});

describe("pageLocale", () => {
  it("uses the proxy header for a public link page", () => {
    expect(pageLocale(new Headers({ [PUBLIC_LOCALE_HEADER]: "ru" }))).toBe("ru");
  });

  it("keeps the default when the request was not marked as a public page", () => {
    expect(pageLocale(new Headers())).toBe("ru");
    // A bogus or unsupported value still falls back; the header is not a locale switch.
    expect(pageLocale(new Headers({ [PUBLIC_LOCALE_HEADER]: "en" }))).toBe("ru");
  });
});
