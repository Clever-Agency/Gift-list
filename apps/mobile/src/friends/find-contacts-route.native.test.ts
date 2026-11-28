import { describe, expect, it } from "vitest";
import { findContactsRoute } from "./find-contacts-route.native";

/**
 * The phone has no contacts sync yet (Story 8.1), so «Найти знакомых» keeps its
 * current behaviour and opens the existing search instead of the browser screen.
 */
describe("find-contacts route (phone)", () => {
  it("keeps the current search shortcut", () => {
    expect(findContactsRoute()).toBe("/search");
  });
});
