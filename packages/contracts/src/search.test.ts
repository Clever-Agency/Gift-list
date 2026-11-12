import { describe, expect, it } from "vitest";

import {
  USER_SEARCH_LIMIT,
  USER_SEARCH_QUERY_MAX,
  userSearchCardSchema,
  userSearchDataSchema,
  userSearchQuerySchema,
} from "./search";

describe("userSearchQuerySchema", () => {
  it("defaults an absent query to an empty string", () => {
    expect(userSearchQuerySchema.parse({})).toEqual({ q: "" });
  });

  it("trims a query and keeps an empty one valid", () => {
    expect(userSearchQuerySchema.parse({ q: "  Анна  " })).toEqual({ q: "Анна" });
    expect(userSearchQuerySchema.parse({ q: "   " })).toEqual({ q: "" });
  });

  it("accepts the cap and rejects one character more", () => {
    expect(userSearchQuerySchema.safeParse({ q: "а".repeat(USER_SEARCH_QUERY_MAX) }).success).toBe(
      true,
    );
    expect(
      userSearchQuerySchema.safeParse({ q: "а".repeat(USER_SEARCH_QUERY_MAX + 1) }).success,
    ).toBe(false);
  });

  it("rejects control characters", () => {
    expect(userSearchQuerySchema.safeParse({ q: "Ан\u0000на" }).success).toBe(false);
  });
});

describe("userSearchDataSchema", () => {
  it("accepts an empty successful list", () => {
    expect(userSearchDataSchema.parse({ users: [] })).toEqual({ users: [] });
  });

  it("keeps only the person card fields", () => {
    expect(userSearchDataSchema.parse({ users: [{ displayName: "Алёна", nick: "alena" }] })).toEqual(
      { users: [{ displayName: "Алёна", nick: "alena" }] },
    );
    expect(
      userSearchCardSchema.safeParse({
        displayName: "Алёна",
        nick: "alena",
        email: "a@example.com",
      }).success,
    ).toBe(false);
  });

  it("rejects a hidden flag or gift data in a card (NFR-3)", () => {
    const card = { displayName: "Алёна", nick: "alena" };
    expect(userSearchDataSchema.safeParse({ users: [{ ...card, hideFromSearch: true }] }).success).toBe(
      false,
    );
    expect(userSearchDataSchema.safeParse({ users: [{ ...card, gifts: [] }] }).success).toBe(false);
  });

  it("exposes one limit constant for both clients", () => {
    expect(USER_SEARCH_LIMIT).toBeGreaterThan(0);
  });
});
