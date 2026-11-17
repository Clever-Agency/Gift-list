import { describe, expect, it } from "vitest";
import { INVITE_TOKEN_MAX } from "@gift-list/contracts";
import { inviteRoute, inviteTokenFromNext } from "@/invite/invite-route";

describe("inviteRoute", () => {
  it("builds the only safe app route for a token", () => {
    expect(inviteRoute("tok_1")).toEqual({ token: "tok_1", next: "/invite/tok_1" });
  });

  it.each([
    ["empty", ""],
    ["missing", undefined],
    ["not a string", 42],
    ["too long", "a".repeat(INVITE_TOKEN_MAX + 1)],
    ["extra segment", "a/b"],
    ["backslash", "a\\b"],
    ["query", "a?b"],
    ["fragment", "a#b"],
    ["percent encoding", "a%2Fb"],
    ["dot segment", "."],
    ["dot pair", ".."],
    ["dot pair inside", "a..b"],
  ])("rejects a malformed segment: %s", (_name, value) => {
    expect(inviteRoute(value)).toBeNull();
  });
});

describe("inviteTokenFromNext", () => {
  it("reads the token of an invite return path", () => {
    expect(inviteTokenFromNext("/invite/tok_1")).toBe("tok_1");
  });

  it.each([
    ["home", "/"],
    ["wishlist", "/wishlist/tok_1"],
    ["raw list link", "/l/tok_1"],
    ["profile", "/u/anna"],
    ["extra segment", "/invite/a/b"],
    ["query", "/invite/tok?x=1"],
    ["fragment", "/invite/tok#top"],
    ["percent encoding", "/invite/a%2Fb"],
    ["empty token", "/invite/"],
    ["dot pair", "/invite/a..b"],
    ["too long", `/invite/${"a".repeat(INVITE_TOKEN_MAX + 1)}`],
  ])("sends no token for a non-invite return path: %s", (_name, next) => {
    expect(inviteTokenFromNext(next)).toBeUndefined();
  });
});
