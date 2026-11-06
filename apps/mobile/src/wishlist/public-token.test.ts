import { describe, expect, it } from "vitest";
import {
  PUBLIC_WISHLIST_TOKEN_MAX_LENGTH,
  publicWishlistRoute,
} from "@/wishlist/public-token";

describe("publicWishlistRoute", () => {
  it("builds the only safe app route for a token", () => {
    expect(publicWishlistRoute("tok_1")).toEqual({
      token: "tok_1",
      next: "/wishlist/tok_1",
    });
  });

  it.each([
    ["empty", ""],
    ["missing", undefined],
    ["not a string", 42],
    ["too long", "a".repeat(PUBLIC_WISHLIST_TOKEN_MAX_LENGTH + 1)],
    ["extra segment", "a/b"],
    ["backslash", "a\\b"],
    ["query", "a?b"],
    ["fragment", "a#b"],
    ["percent encoding", "a%2Fb"],
    ["dot segment", "."],
    ["dot pair", ".."],
    ["dot pair inside", "a..b"],
  ])("rejects a malformed segment: %s", (_name, value) => {
    expect(publicWishlistRoute(value)).toBeNull();
  });
});
