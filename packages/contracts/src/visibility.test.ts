import { describe, expect, it } from "vitest";
import { isWishVisibleToEveryone } from "./visibility";

describe("isWishVisibleToEveryone", () => {
  it("accepts only a PUBLIC wish that is not archived", () => {
    expect(isWishVisibleToEveryone({ visibility: "PUBLIC", archivedAt: null })).toBe(true);
  });

  it("rejects private, secret and archived PUBLIC wishes", () => {
    expect(isWishVisibleToEveryone({ visibility: "FRIENDS", archivedAt: null })).toBe(false);
    expect(isWishVisibleToEveryone({ visibility: "SECRET", archivedAt: null })).toBe(false);
    expect(
      isWishVisibleToEveryone({ visibility: "PUBLIC", archivedAt: "2026-01-01T00:00:00.000Z" }),
    ).toBe(false);
    expect(
      isWishVisibleToEveryone({ visibility: "PUBLIC", archivedAt: new Date("2026-01-01T00:00:00Z") }),
    ).toBe(false);
  });
});
