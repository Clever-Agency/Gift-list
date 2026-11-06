import { describe, expect, it } from "vitest";
import { isPublicTokenSegment, wishlistPathForToken } from "./public-token";

describe("isPublicTokenSegment", () => {
  it("accepts one short identifier segment", () => {
    expect(isPublicTokenSegment("tok-1")).toBe(true);
    expect(isPublicTokenSegment("clx1Example_42")).toBe(true);
    expect(isPublicTokenSegment("x".repeat(128))).toBe(true);
  });

  it("rejects empty, oversized and multi-segment values", () => {
    expect(isPublicTokenSegment("")).toBe(false);
    expect(isPublicTokenSegment("x".repeat(129))).toBe(false);
    expect(isPublicTokenSegment("a/b")).toBe(false);
    expect(isPublicTokenSegment("a\\b")).toBe(false);
    expect(isPublicTokenSegment("https://evil.example/l/tok")).toBe(false);
  });

  it("rejects dot segments and encoded path characters before the database", () => {
    for (const token of [".", "..", "a..b", "%2f", "%5C", "%2e%2e"]) {
      expect(isPublicTokenSegment(token)).toBe(false);
    }
  });
});

describe("wishlistPathForToken", () => {
  it("builds the one allowed relative target from the validated segment", () => {
    expect(wishlistPathForToken("tok-1")).toBe("/wishlist/tok-1");
  });

  it("returns no target for dot segments, encoded paths or absolute URLs", () => {
    for (const token of [
      "",
      "..",
      "../admin",
      "a/b",
      "//evil.example",
      "https://evil.example",
      "%2e%2e",
      "tok?next=//evil.example",
      "tok#fragment",
    ]) {
      expect(wishlistPathForToken(token)).toBeNull();
    }
  });
});
