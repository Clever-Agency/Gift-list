import { describe, expect, it } from "vitest";
import { findContactsRoute } from "./find-contacts-route";

/**
 * Story 6.5: in a browser «Найти знакомых» has its own screen with the
 * explanation and search by nick. The phone twin is pinned in
 * `find-contacts-route.native.test.ts`.
 */
describe("find-contacts route (browser)", () => {
  it("opens the explanation screen", () => {
    expect(findContactsRoute()).toBe("/friends/contacts");
  });
});
