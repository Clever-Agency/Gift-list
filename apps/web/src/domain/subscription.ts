// AD-19 / FR-46 — the subscription write protocol. Rules only: no Prisma, no
// React/Next.js here (AD-1). The caller hands over a `SubscriptionStore`; the
// Prisma adapter in `lib/subscription-store.ts` owns every table write.
//
// A subscription is a **directed** `Subscription(subscriberId, targetId)` edge
// created without confirmation. The pair is not canonical, so A→B and B→A are
// two independent rows, and neither row is a `Friendship`: the `friend` fact of
// `VisibilityPolicy` stays false, so a subscription opens PUBLIC wishes only
// (AD-7, D-31). Repeating a subscribe is a successful no-op; a repeat delete is
// a no-op too. A `Block` in either direction forbids a new edge; deleting the
// rows of a blocked pair belongs to the Block mutations of Story 4.5.

/** Closed success outcomes of subscribing; the wire values are in contracts. */
export const SUBSCRIBE_OUTCOMES = [
  /** A new directed row was inserted. */
  "SUBSCRIBED",
  /** The directed row already existed; nothing was written. */
  "ALREADY_SUBSCRIBED",
] as const;

export type SubscribeOutcome = (typeof SUBSCRIBE_OUTCOMES)[number];

/** Closed success outcomes of removing one directed edge. */
export const SUBSCRIPTION_REMOVAL_OUTCOMES = [
  /** The directed row was deleted. */
  "UNSUBSCRIBED",
  /** The directed row was already gone; nothing was written. */
  "NOT_SUBSCRIBED",
] as const;

export type SubscriptionRemovalOutcome = (typeof SUBSCRIPTION_REMOVAL_OUTCOMES)[number];

/** The two refusals of the protocol; both answer `FORBIDDEN` on the wire (AD-12). */
export type SubscriptionRefusalReason = "SELF_SUBSCRIPTION" | "BLOCKED";

export type SubscribeResult =
  | { readonly ok: true; readonly outcome: SubscribeOutcome }
  | {
      readonly ok: false;
      readonly code: "FORBIDDEN";
      readonly reason: SubscriptionRefusalReason;
    };

/**
 * Removing is allowed for either side of the edge and cannot fail on a missing
 * row. The only refusal is a self pair, which can never be stored because the
 * migration CHECK forbids `subscriberId = targetId`.
 */
export type RemoveSubscriptionResult =
  | { readonly ok: true; readonly outcome: SubscriptionRemovalOutcome }
  | {
      readonly ok: false;
      readonly code: "FORBIDDEN";
      readonly reason: "SELF_SUBSCRIPTION";
    };

/**
 * The operations the protocol needs. The adapter answers only the facts the
 * rules ask for; it never decides the outcome itself and knows nothing about
 * friendships, so a subscription can never create one.
 */
export interface SubscriptionStore {
  /**
   * Inserts the directed edge and answers whether a row was created. The
   * UNIQUE `(subscriberId, targetId)` index makes a repeat insert a no-op
   * instead of a second row or an error.
   */
  createSubscription(subscriberId: string, targetId: string): Promise<boolean>;
  /** Deletes the directed edge and answers whether a row was removed. */
  deleteSubscription(subscriberId: string, targetId: string): Promise<boolean>;
  /** A `Block` row between the two users in either direction (AD-10 step 4). */
  hasBlockBetween(firstUserId: string, secondUserId: string): Promise<boolean>;
}

/**
 * Subscribe `subscriberId` to `targetId` (Story 4.6, FR-46, AD-19).
 *
 * Subscribing to yourself and subscribing across a Block in either direction
 * are both the closed `FORBIDDEN` refusal and write nothing. An existing row is
 * returned as the successful no-op `ALREADY_SUBSCRIBED`; the UNIQUE index is
 * the last guard against a duplicate under a race.
 */
export async function subscribeToUser(
  input: { readonly subscriberId: string; readonly targetId: string },
  store: SubscriptionStore,
): Promise<SubscribeResult> {
  const { subscriberId, targetId } = input;
  if (subscriberId === targetId) {
    return { ok: false, code: "FORBIDDEN", reason: "SELF_SUBSCRIPTION" };
  }
  if (await store.hasBlockBetween(subscriberId, targetId)) {
    return { ok: false, code: "FORBIDDEN", reason: "BLOCKED" };
  }

  const created = await store.createSubscription(subscriberId, targetId);
  return { ok: true, outcome: created ? "SUBSCRIBED" : "ALREADY_SUBSCRIBED" };
}

/**
 * Remove the directed edge `subscriberId → targetId` (Story 4.6, AD-19).
 *
 * The subscriber unsubscribing from the owner and the target removing a
 * subscriber are the same primitive with the two ids swapped by the caller.
 * Either side may remove the row, and a row that is already gone is the
 * successful no-op `NOT_SUBSCRIBED`. The block is deliberately not read here:
 * a block must never keep a stale row alive, and refusing would leak the block
 * instead of quietly cleaning up.
 */
export async function removeSubscription(
  input: { readonly subscriberId: string; readonly targetId: string },
  store: SubscriptionStore,
): Promise<RemoveSubscriptionResult> {
  const { subscriberId, targetId } = input;
  if (subscriberId === targetId) {
    return { ok: false, code: "FORBIDDEN", reason: "SELF_SUBSCRIPTION" };
  }

  const removed = await store.deleteSubscription(subscriberId, targetId);
  return { ok: true, outcome: removed ? "UNSUBSCRIBED" : "NOT_SUBSCRIBED" };
}
