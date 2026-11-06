import { describe, expect, it } from "vitest";
import { profileRoute } from "@/profile/profile-route";

describe("profileRoute", () => {
  it("builds the API segment and the login next from one nick", () => {
    expect(profileRoute("anya")).toEqual({ nick: "anya", next: "/u/anya" });
  });

  it("normalizes case and surrounding spaces like the server (AD-13)", () => {
    expect(profileRoute("  Anna_1 ")).toEqual({ nick: "anna_1", next: "/u/anna_1" });
  });

  it("accepts the shortest and the longest nick", () => {
    expect(profileRoute("abc")).toEqual({ nick: "abc", next: "/u/abc" });
    const longest = "a".repeat(24);
    expect(profileRoute(longest)).toEqual({ nick: longest, next: `/u/${longest}` });
  });

  it.each([
    undefined,
    null,
    42,
    "",
    "   ",
    "ab",
    "a".repeat(25),
    "anna-1",
    "аня",
    "a/b",
    "a?b",
    "a#b",
    "a.b",
    "..",
    "%2f",
    "a b",
  ])("rejects %j as a nick", (value) => {
    expect(profileRoute(value)).toBeNull();
  });
});
