import { describe, expect, it } from "vitest";
import {
  invitePathForToken,
  isPublicTokenSegment,
  publicListPathForToken,
  wishlistPathForToken,
} from "./public-token";

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

  it.each(["tok?", "tok#", "tok%", "tok\u0000", "tok\u001f", "tok\u007f"])(
    "rejects an unsafe URL segment in the API and on the page (%j)",
    function checkUnsafeToken(token) {
      expect(isPublicTokenSegment(token)).toBe(false);
      expect(wishlistPathForToken(token)).toBeNull();
      expect(publicListPathForToken(token)).toBeNull();
    },
  );
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

describe("publicListPathForToken", () => {
  it("builds the public address of the list from the validated segment", () => {
    expect(publicListPathForToken("tok-1")).toBe("/l/tok-1");
  });

  it("returns no target for the same segments the redirect refuses", () => {
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
      expect(publicListPathForToken(token)).toBeNull();
    }
  });
});

describe("invitePathForToken", () => {
  it("builds the one allowed app target from the validated segment", () => {
    expect(invitePathForToken("tok-1")).toBe("/invite/tok-1");
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
      expect(invitePathForToken(token)).toBeNull();
    }
  });
});
