import { describe, expect, it } from "vitest";
import {
  FRIEND_INVITE_OUTCOMES,
  PROFILE_RELATIONSHIPS,
  friendInviteDataSchema,
  listDataSchema,
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
