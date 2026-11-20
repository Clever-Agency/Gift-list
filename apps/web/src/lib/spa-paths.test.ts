import { describe, expect, it } from "vitest";
import { NEXT_OWNED_PREFIXES, isNextOwnedPath, spaFallbackRewriteSources } from "./spa-paths";

describe("isNextOwnedPath", () => {
  it.each([
    "/api",
    "/api/nope",
    "/api/v1/nope",
    "/api/auth",
    "/l/abc",
    "/i/abc",
    "/unsubscribe/t",
    "/admin",
    "/.well-known/assetlinks.json",
  ])(
    "owns %s",
    (pathname) => {
      expect(isNextOwnedPath(pathname)).toBe(true);
    },
  );

  it.each([
    "/",
    "/login",
    "/register",
    "/forgot",
    "/reset",
    "/wishlist/x",
    "/lists",
    "/long",
    "/invite",
    "/reservations",
  ])("leaves %s to the SPA", (pathname) => {
    expect(isNextOwnedPath(pathname)).toBe(false);
  });

  /**
   * Story 5.5: «Мои брони» is an Expo route, not a Next page — `/reservations`
   * must fall into the same SPA fallback as the wishlist, so a browser opening the
   * URL gets the app and not a Next 404.
   */
  it("leaves the holder's reservations to the SPA fallback", () => {
    expect(isNextOwnedPath("/reservations")).toBe(false);
    const source = spaFallbackRewriteSources()[1] ?? "";
    expect(source).not.toContain("reservations");
  });

  it("builds a fallback source that names every Next prefix", () => {
    const sources = spaFallbackRewriteSources();
    expect(sources[0]).toBe("/");
    expect(sources[1]).toContain("api(?:/|$)");
    expect(sources[1]).toContain("\\.well-known(?:/|$)");
    expect(sources[1]).not.toContain("lists");
  });

  it("names every Next-owned prefix in the fallback source", () => {
    const source = spaFallbackRewriteSources()[1] ?? "";
    for (const prefix of NEXT_OWNED_PREFIXES) {
      const body = prefix.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(source).toContain(`${body}(?:/|$)`);
    }
  });
});
