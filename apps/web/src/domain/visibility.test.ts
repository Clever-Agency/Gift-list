import { describe, expect, it } from "vitest";
import { VisibilityPolicy } from "./visibility";

const owner = { id: "u1" };

describe("VisibilityPolicy.resolve — owner branch", () => {
  it.each(["PUBLIC", "FRIENDS", "SECRET"] as const)("shows the owner their own %s gift", (visibility) => {
    expect(VisibilityPolicy.resolve(owner, { ownerId: "u1", visibility })).toEqual({
      visible: true,
      role: "owner",
    });
  });

  it("hides every gift from a signed-in viewer who is not the owner", () => {
    for (const visibility of ["PUBLIC", "FRIENDS", "SECRET"] as const) {
      expect(VisibilityPolicy.resolve({ id: "u2" }, { ownerId: "u1", visibility })).toEqual({
        visible: false,
      });
    }
  });

  it("hides every gift from an anonymous viewer", () => {
    expect(VisibilityPolicy.resolve(null, { ownerId: "u1", visibility: "PUBLIC" })).toEqual({
      visible: false,
    });
  });
});
