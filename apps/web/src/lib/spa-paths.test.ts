import { describe, expect, it } from "vitest";
import { NEXT_OWNED_PREFIXES, isNextOwnedPath, spaFallbackRewriteSources } from "./spa-paths";

/**
 * Story 6.5: every path the Expo SPA owns. A browser that opens or refreshes one
 * of them must get the app shell, not a Next 404; the SPA side of the same paths
 * (the screen that mounts) is `apps/mobile/src/navigation/spa-routes.test.tsx`.
 */
const SPA_ROUTE_PATHS = [
  "/",
  "/search",
  "/friends",
  "/friends/contacts",
  "/reservations",
  "/profile",
  "/settings",
  "/notifications",
  "/collections",
  "/collections/c-1",
  "/gifts/new",
  "/gifts/g-1",
  "/gifts/g-1/edit",
  "/u/anya",
  "/invite/tok-1",
  "/wishlist/tok-1",
  "/login",
  "/register",
  "/forgot",
  "/reset",
] as const;

/** Next's own pages: the App Links, the invite preview, the unsubscribe page and `/admin`. */
const NEXT_OWNED_PATHS = [
  "/api",
  "/api/v1/me",
  "/l/tok-1",
  "/l/tok-1/g-1",
  "/i/tok-1",
  "/unsubscribe/tok-1",
  "/admin",
  "/admin/collections",
  "/.well-known/assetlinks.json",
] as const;

/**
 * The fallback rewrite source (`/:path((?!…).*)`) as a matcher, read the way
 * path-to-regexp reads it: the custom group is the text after `:path(` without
 * the group's closing parenthesis.
 */
function fallbackRewriteMatches(pathname: string): boolean {
  const source = spaFallbackRewriteSources()[1] ?? "";
  const open = source.indexOf("(");
  if (open < 0 || !source.endsWith(")")) throw new Error(`Не разобрать источник ${source}`);
  const custom = source.slice(open + 1, -1);
  return new RegExp(`^/${custom}$`).test(pathname);
}

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
    "/notifications",
    "/collections",
    "/collections/c-1",
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

/**
 * Story 6.5: a deep link and a page refresh land on the same screen as the
 * phone. The web half is here — the shell must be what Next answers; the SPA
 * half is `apps/mobile/src/navigation/spa-routes.test.tsx`.
 */
describe("глубокая ссылка и обновление страницы (Story 6.5)", () => {
  it.each(SPA_ROUTE_PATHS)("отдаёт %s приложению, а не Next", (pathname) => {
    expect(isNextOwnedPath(pathname)).toBe(false);
    expect(fallbackRewriteMatches(pathname)).toBe(true);
  });

  it.each(NEXT_OWNED_PATHS)("не забирает %s у Next", (pathname) => {
    expect(isNextOwnedPath(pathname)).toBe(true);
    expect(fallbackRewriteMatches(pathname)).toBe(false);
  });
});
