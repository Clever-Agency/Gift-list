import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { PUBLIC_LOCALE_HEADER } from "@/lib/request-locale";

function forwardedLocale(request: NextRequest): string | null {
  const response = proxy(request);
  return response.headers.get(`x-middleware-request-${PUBLIC_LOCALE_HEADER}`);
}

describe("proxy locale for the public link and invite pages", () => {
  it("marks /l, /i and /unsubscribe requests with the negotiated language", () => {
    for (const path of [
      "/l/tok-1",
      "/l",
      "/i/tok-1",
      "/i",
      "/unsubscribe/tok-1",
      "/unsubscribe",
    ]) {
      expect(
        forwardedLocale(
          new NextRequest(`https://gift.example${path}`, {
            headers: { "accept-language": "ru-RU,ru;q=0.9,en;q=0.8" },
          }),
        ),
        path,
      ).toBe("ru");
    }
  });

  it("does not mark the SPA app route /invite", () => {
    expect(
      forwardedLocale(
        new NextRequest("https://gift.example/invite/tok-1", {
          headers: { "accept-language": "ru" },
        }),
      ),
    ).toBeNull();
  });

  it("does not forward a language to API or other pages", () => {
    expect(
      forwardedLocale(
        new NextRequest("https://gift.example/api/v1/l/tok-1", {
          headers: { "accept-language": "ru" },
        }),
      ),
    ).toBeNull();
    expect(
      forwardedLocale(
        new NextRequest("https://gift.example/admin", {
          headers: { "accept-language": "ru" },
        }),
      ),
    ).toBeNull();
  });
});
