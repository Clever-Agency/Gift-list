import { describe, expect, it } from "vitest";
import { canonicalTimeZone, storedTimeZone } from "./time-zone";

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

describe("storedTimeZone", () => {
  it("treats blank as unset", () => {
    expect(storedTimeZone(null)).toBeNull();
    expect(storedTimeZone("")).toBeNull();
    expect(storedTimeZone("UTC")).toBe("UTC");
  });
});
