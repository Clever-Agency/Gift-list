import { describe, expect, it } from "vitest";
import {
  INVITE_LINK_ACCEPT_OUTCOMES,
  INVITE_LINK_STATES,
  actionResultSchema,
  inviteLinkAcceptDataSchema,
  inviteLinkDataSchema,
  inviteLinkInviterSchema,
  inviteLinkPreviewSchema,
} from "./index";

const inviter = { displayName: "Анна", nick: "anna" };

describe("inviteLinkPreviewSchema (Story 4.7)", () => {
  it("names the inviter with the two public fields of a list owner", () => {
    expect(inviteLinkPreviewSchema.parse({ inviter })).toEqual({ inviter });
    expect(Object.keys(inviteLinkInviterSchema.shape).sort()).toEqual(["displayName", "nick"]);
  });

  it("carries a state only for a signed-in viewer and only from the closed set", () => {
    for (const state of INVITE_LINK_STATES) {
      expect(inviteLinkPreviewSchema.safeParse({ inviter, state }).success, state).toBe(true);
    }
    expect(INVITE_LINK_STATES).toEqual(["self", "friends", "can_accept"]);
    expect(inviteLinkPreviewSchema.safeParse({ inviter, state: "not_found" }).success).toBe(false);
    expect(inviteLinkPreviewSchema.safeParse({ inviter, state: "FRIENDS" }).success).toBe(false);
  });

  it("rejects the internal id, an email, an avatar, a wish and the relation fields", () => {
    for (const extra of [
      { inviter: { ...inviter, id: "u1" } },
      { inviter: { ...inviter, email: "a@example.com" } },
      { inviter: { ...inviter, avatar: "x" } },
      { inviter: { ...inviter, image: "x" } },
      { inviter, gifts: [] },
      { inviter, subscribed: false },
      { inviter, relationship: "FRIENDS" },
    ]) {
      expect(inviteLinkPreviewSchema.safeParse(extra).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it("requires the inviter itself", () => {
    expect(inviteLinkPreviewSchema.safeParse({ state: "self" }).success).toBe(false);
    expect(inviteLinkPreviewSchema.safeParse({ inviter: { nick: "anna" } }).success).toBe(false);
    expect(inviteLinkPreviewSchema.safeParse({ inviter: { displayName: "Анна" } }).success).toBe(
      false,
    );
  });

  it("fits the AD-12 success envelope", () => {
    const envelope = actionResultSchema(inviteLinkPreviewSchema);
    expect(envelope.safeParse({ ok: true, data: { inviter, state: "friends" } }).success).toBe(
      true,
    );
    expect(
      envelope.safeParse({ ok: true, data: { inviter: { ...inviter, id: "u1" } } }).success,
    ).toBe(false);
  });
});

describe("inviteLinkDataSchema (Story 4.7)", () => {
  it("carries the immutable token and nothing else", () => {
    expect(inviteLinkDataSchema.parse({ token: "cu2abc" })).toEqual({ token: "cu2abc" });
    expect(Object.keys(inviteLinkDataSchema.shape)).toEqual(["token"]);
  });

  it("does not fix a domain or a scheme on the wire", () => {
    expect(inviteLinkDataSchema.safeParse({ token: "cu2abc", url: "https://x/i/cu2abc" }).success).toBe(
      false,
    );
    expect(inviteLinkDataSchema.safeParse({}).success).toBe(false);
    expect(inviteLinkDataSchema.safeParse({ token: 1 }).success).toBe(false);
  });
});

describe("inviteLinkAcceptDataSchema (Story 4.7)", () => {
  it("keeps exactly the two closed outcomes", () => {
    for (const outcome of INVITE_LINK_ACCEPT_OUTCOMES) {
      expect(inviteLinkAcceptDataSchema.safeParse({ outcome }).success, outcome).toBe(true);
    }
    expect(INVITE_LINK_ACCEPT_OUTCOMES).toEqual(["FRIENDS", "ALREADY_FRIENDS"]);
    expect(inviteLinkAcceptDataSchema.safeParse({ outcome: "FRIENDS_CREATED" }).success).toBe(false);
    expect(inviteLinkAcceptDataSchema.safeParse({ outcome: "friends" }).success).toBe(false);
  });

  it("rejects extra fields, so the owner and the direction cannot ride along", () => {
    expect(
      inviteLinkAcceptDataSchema.safeParse({ outcome: "FRIENDS", owner: inviter }).success,
    ).toBe(false);
    expect(inviteLinkAcceptDataSchema.safeParse({ outcome: "FRIENDS", status: 200 }).success).toBe(
      false,
    );
  });
});
