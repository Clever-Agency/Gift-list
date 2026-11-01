import { describe, expect, it } from "vitest";
import { NEXT_OWNED_PREFIXES, isNextOwnedPath, spaFallbackRewriteSources } from "./spa-paths";

describe("isNextOwnedPath", () => {
  it.each(["/api", "/api/auth", "/l/abc", "/i/abc", "/unsubscribe/t", "/admin", "/.well-known/assetlinks.json"])(
    "owns %s",
    (pathname) => {
      expect(isNextOwnedPath(pathname)).toBe(true);
    },
  );

  it.each(["/", "/login", "/register", "/forgot", "/reset", "/wishlist/x", "/lists", "/long", "/invite"])(
    "leaves %s to the SPA",
    (pathname) => {
      expect(isNextOwnedPath(pathname)).toBe(false);
    },
  );

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
