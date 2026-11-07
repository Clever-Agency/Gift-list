import { describe, expect, it } from "vitest";
import {
  FRIEND_ACCEPT_OUTCOMES,
  FRIEND_INVITE_OUTCOMES,
  FRIEND_REJECT_OUTCOMES,
  PROFILE_RELATIONSHIPS,
  friendAcceptDataSchema,
  friendInviteDataSchema,
  friendRejectDataSchema,
  listDataSchema,
  profileInviteCooldownSchema,
  profileRelationshipSchema,
} from "./index";

describe("friendInviteDataSchema", () => {
  it.each(FRIEND_INVITE_OUTCOMES)("accepts the closed outcome %s", (outcome) => {
    expect(friendInviteDataSchema.safeParse({ outcome }).success).toBe(true);
  });

  it("rejects an outcome outside the closed set", () => {
    expect(friendInviteDataSchema.safeParse({ outcome: "REJECTED" }).success).toBe(false);
    expect(friendInviteDataSchema.safeParse({ outcome: "created" }).success).toBe(false);
  });

  it("rejects extra fields, so no user id or token can ride along", () => {
    expect(
      friendInviteDataSchema.safeParse({
        outcome: "INVITED",
        userId: "u1",
        publicToken: "tok",
      }).success,
    ).toBe(false);
    expect(friendInviteDataSchema.safeParse({ outcome: "INVITED", user: { id: "u1" } }).success).toBe(
      false,
    );
  });
});

describe("profile relationship", () => {
  it("accepts exactly the closed relation values", () => {
    expect(PROFILE_RELATIONSHIPS).toEqual([
      "NONE",
      "OUTGOING_PENDING",
      "INCOMING_PENDING",
      "FRIENDS",
    ]);
    for (const relationship of PROFILE_RELATIONSHIPS) {
      expect(profileRelationshipSchema.safeParse(relationship).success).toBe(true);
      expect(
        listDataSchema.safeParse({ access: "gifts", gifts: [], relationship }).success,
      ).toBe(true);
    }
  });

  it("rejects an invented relation", () => {
    expect(profileRelationshipSchema.safeParse("SUBSCRIBED").success).toBe(false);
    expect(
      listDataSchema.safeParse({ access: "gifts", gifts: [], relationship: "BLOCKED" }).success,
    ).toBe(false);
  });

  it("stays optional, so /l and /me answers parse unchanged", () => {
    expect(listDataSchema.safeParse({ access: "gifts", gifts: [] }).success).toBe(true);
  });

  it("is absent from a closed gate", () => {
    expect(
      listDataSchema.safeParse({ access: "not_found", gifts: [], relationship: "NONE" }).success,
    ).toBe(false);
  });

  it("rejects a relationship nested in a gift card", () => {
    expect(
      listDataSchema.safeParse({
        access: "gifts",
        gifts: [],
        owner: { displayName: "Анна", nick: "anna", relationship: "FRIENDS" },
      }).success,
    ).toBe(false);
  });
});

describe("friend accept/reject data (Story 4.2.2)", () => {
  it.each(FRIEND_ACCEPT_OUTCOMES)("accepts the accept outcome %s", (outcome) => {
    expect(friendAcceptDataSchema.safeParse({ outcome }).success).toBe(true);
  });

  it("keeps the accept outcome closed", () => {
    expect(friendAcceptDataSchema.safeParse({ outcome: "INVITED" }).success).toBe(false);
    expect(friendAcceptDataSchema.safeParse({ outcome: "REJECTED" }).success).toBe(false);
    expect(
      friendAcceptDataSchema.safeParse({ outcome: "FRIENDS_CREATED", userId: "u1" }).success,
    ).toBe(false);
  });

  it("accepts exactly the closed reject outcome", () => {
    expect(FRIEND_REJECT_OUTCOMES).toEqual(["REJECTED"]);
    expect(friendRejectDataSchema.safeParse({ outcome: "REJECTED" }).success).toBe(true);
    expect(friendRejectDataSchema.safeParse({ outcome: "INVITED" }).success).toBe(false);
    expect(
      friendRejectDataSchema.safeParse({ outcome: "REJECTED", message: "rejected" }).success,
    ).toBe(false);
  });
});

describe("profile invite cooldown (Story 4.2.2)", () => {
  it("accepts integer hours and the rejected flag", () => {
    expect(profileInviteCooldownSchema.safeParse({ hours: 1, rejected: true }).success).toBe(true);
    expect(profileInviteCooldownSchema.safeParse({ hours: 24, rejected: false }).success).toBe(true);
  });

  it("rejects zero, fractional or negative hours", () => {
    expect(profileInviteCooldownSchema.safeParse({ hours: 0, rejected: true }).success).toBe(false);
    expect(profileInviteCooldownSchema.safeParse({ hours: 1.5, rejected: true }).success).toBe(false);
    expect(profileInviteCooldownSchema.safeParse({ hours: -1, rejected: true }).success).toBe(false);
  });

  it("rejects extra fields and a missing rejected flag", () => {
    expect(
      profileInviteCooldownSchema.safeParse({ hours: 3, rejected: true, active: true }).success,
    ).toBe(false);
    expect(profileInviteCooldownSchema.safeParse({ hours: 3 }).success).toBe(false);
  });

  it("rides only on an open profile answer, never on a closed gate", () => {
    const inviteCooldown = { hours: 3, rejected: false };
    expect(
      listDataSchema.safeParse({ access: "gifts", gifts: [], inviteCooldown }).success,
    ).toBe(true);
    expect(
      listDataSchema.safeParse({ access: "not_found", gifts: [], inviteCooldown }).success,
    ).toBe(false);
  });

  it("stays optional, so /l and /me answers parse unchanged", () => {
    expect(listDataSchema.safeParse({ access: "gifts", gifts: [] }).success).toBe(true);
  });
});
