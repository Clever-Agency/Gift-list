import { describe, expect, it } from "vitest";
import { canonicalTimeZone, knownTimeZone, storedTimeZone } from "./time-zone";

describe("canonicalTimeZone", () => {
  it("keeps a known IANA zone and UTC", () => {
    expect(canonicalTimeZone("Europe/Minsk")).toBe("Europe/Minsk");
    expect(canonicalTimeZone("UTC")).toBe("UTC");
  });

  it("falls back to UTC", () => {
    expect(canonicalTimeZone("")).toBe("UTC");
    expect(canonicalTimeZone("Not/AZone")).toBe("UTC");
    expect(canonicalTimeZone(undefined)).toBe("UTC");
  });
});

describe("knownTimeZone", () => {
  it("returns a known IANA zone and nothing otherwise", () => {
    expect(knownTimeZone("Europe/Minsk")).toBe("Europe/Minsk");
    expect(knownTimeZone("UTC")).toBe("UTC");
    expect(knownTimeZone("Not/AZone")).toBeNull();
    expect(knownTimeZone("")).toBeNull();
    expect(knownTimeZone(undefined)).toBeNull();
    expect(knownTimeZone(42)).toBeNull();
  });
});

describe("storedTimeZone", () => {
  it("treats blank as unset", () => {
    expect(storedTimeZone(null)).toBeNull();
    expect(storedTimeZone("")).toBeNull();
    expect(storedTimeZone("UTC")).toBe("UTC");
  });
});
