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

  /**
   * Story 6.2: the five sections and «Профиль» are Expo routes, so a browser that
   * opens or refreshes `/profile`, `/friends` and the rest must land on the SPA,
   * not on a Next 404. The App Link doubles `/l/*`, `/i/*` and `/.well-known/*`
   * stay Next-owned (AD-26); `spa-paths.ts` itself needs no change for that.
   */
  it("leaves the tab routes and /profile to the SPA, keeps the app links with Next", () => {
    for (const pathname of ["/", "/search", "/friends", "/reservations", "/profile"]) {
      expect(isNextOwnedPath(pathname)).toBe(false);
    }
    for (const pathname of ["/l/tok", "/i/tok", "/.well-known/assetlinks.json"]) {
      expect(isNextOwnedPath(pathname)).toBe(true);
    }

    const source = spaFallbackRewriteSources()[1] ?? "";
    expect(source).not.toContain("profile");
    expect(source).toContain("l(?:/|$)");
    expect(source).toContain("i(?:/|$)");
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
