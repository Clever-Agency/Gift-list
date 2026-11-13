import { describe, expect, it } from "vitest";
import {
  SUBSCRIBE_OUTCOMES,
  SUBSCRIPTION_REMOVAL_OUTCOMES,
  actionResultSchema,
  subscribeDataSchema,
  subscriptionRemovalDataSchema,
} from "./index";

describe("subscribeDataSchema (Story 4.6)", () => {
  it.each(SUBSCRIBE_OUTCOMES)("accepts the closed outcome %s", (outcome) => {
    expect(subscribeDataSchema.safeParse({ outcome }).success).toBe(true);
  });

  it("keeps exactly the two closed outcomes", () => {
    expect(SUBSCRIBE_OUTCOMES).toEqual(["SUBSCRIBED", "ALREADY_SUBSCRIBED"]);
    expect(subscribeDataSchema.safeParse({ outcome: "UNSUBSCRIBED" }).success).toBe(false);
    expect(subscribeDataSchema.safeParse({ outcome: "subscribed" }).success).toBe(false);
  });

  it("rejects extra fields, so no user id or token can ride along", () => {
    expect(
      subscribeDataSchema.safeParse({
        outcome: "SUBSCRIBED",
        userId: "u1",
        publicToken: "tok",
      }).success,
    ).toBe(false);
    expect(subscribeDataSchema.safeParse({ outcome: "SUBSCRIBED", user: { id: "u1" } }).success).toBe(
      false,
    );
  });

  it("fits the AD-12 success envelope", () => {
    const envelope = actionResultSchema(subscribeDataSchema);
    expect(envelope.safeParse({ ok: true, data: { outcome: "ALREADY_SUBSCRIBED" } }).success).toBe(
      true,
    );
    expect(envelope.safeParse({ ok: true, data: { outcome: "SUBSCRIBED", extra: 1 } }).success).toBe(
      false,
    );
  });
});

describe("subscriptionRemovalDataSchema (Story 4.6)", () => {
  it.each(SUBSCRIPTION_REMOVAL_OUTCOMES)("accepts the closed outcome %s", (outcome) => {
    expect(subscriptionRemovalDataSchema.safeParse({ outcome }).success).toBe(true);
  });

  it("keeps exactly the two closed removal outcomes", () => {
    expect(SUBSCRIPTION_REMOVAL_OUTCOMES).toEqual(["UNSUBSCRIBED", "NOT_SUBSCRIBED"]);
    expect(subscriptionRemovalDataSchema.safeParse({ outcome: "SUBSCRIBED" }).success).toBe(false);
    expect(subscriptionRemovalDataSchema.safeParse({ outcome: "REMOVED" }).success).toBe(false);
  });

  it("rejects extra fields and a missing outcome", () => {
    expect(
      subscriptionRemovalDataSchema.safeParse({ outcome: "UNSUBSCRIBED", targetId: "u1" }).success,
    ).toBe(false);
    expect(subscriptionRemovalDataSchema.safeParse({}).success).toBe(false);
  });

  it("serves both removal routes with one vocabulary", () => {
    const envelope = actionResultSchema(subscriptionRemovalDataSchema);
    expect(envelope.safeParse({ ok: true, data: { outcome: "NOT_SUBSCRIBED" } }).success).toBe(true);
    expect(
      envelope.safeParse({ ok: false, code: "FORBIDDEN", message: "Forbidden" }).success,
    ).toBe(true);
  });
});
