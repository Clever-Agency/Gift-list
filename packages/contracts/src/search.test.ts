import { describe, expect, it } from "vitest";

import {
  USER_SEARCH_LIMIT,
  USER_SEARCH_QUERY_MAX,
  userSearchCardSchema,
  userSearchDataSchema,
  userSearchQuerySchema,
} from "./search";

const card = { displayName: "Алёна", nick: "alena", relationship: "NONE" };

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

  it("keeps the person card fields and the viewer relation", () => {
    expect(userSearchDataSchema.parse({ users: [card] })).toEqual({ users: [card] });
    expect(
      userSearchCardSchema.safeParse({
        ...card,
        email: "a@example.com",
      }).success,
    ).toBe(false);
  });

  it("carries the same closed relation vocabulary as the profile (Story 4.1.2)", () => {
    for (const relationship of ["NONE", "OUTGOING_PENDING", "INCOMING_PENDING", "FRIENDS"]) {
      expect(userSearchDataSchema.safeParse({ users: [{ ...card, relationship }] }).success).toBe(
        true,
      );
    }
    expect(
      userSearchDataSchema.safeParse({ users: [{ ...card, relationship: "BLOCKED" }] }).success,
    ).toBe(false);
    expect(
      userSearchDataSchema.safeParse({ users: [{ ...card, relationship: "SELF" }] }).success,
    ).toBe(false);
  });

  it("requires the relation on every card", () => {
    expect(
      userSearchDataSchema.safeParse({ users: [{ displayName: "Алёна", nick: "alena" }] }).success,
    ).toBe(false);
  });

  it("accepts the profile invite cooldown in the same shape as the profile field", () => {
    const cooldown = { hours: 5, rejected: true };

    expect(
      userSearchDataSchema.safeParse({ users: [{ ...card, inviteCooldown: cooldown }] }).success,
    ).toBe(true);
    expect(
      userSearchDataSchema.safeParse({
        users: [{ ...card, inviteCooldown: { hours: 0, rejected: true } }],
      }).success,
    ).toBe(false);
    expect(
      userSearchDataSchema.safeParse({ users: [{ ...card, inviteCooldown: { hours: 5 } }] })
        .success,
    ).toBe(false);
  });

  it("rejects a hidden flag or gift data in a card (NFR-3)", () => {
    expect(
      userSearchDataSchema.safeParse({ users: [{ ...card, hideFromSearch: true }] }).success,
    ).toBe(false);
    expect(userSearchDataSchema.safeParse({ users: [{ ...card, gifts: [] }] }).success).toBe(false);
    expect(userSearchDataSchema.safeParse({ users: [{ ...card, id: "u1" }] }).success).toBe(false);
  });

  it("exposes one limit constant for both clients", () => {
    expect(USER_SEARCH_LIMIT).toBeGreaterThan(0);
  });
});
