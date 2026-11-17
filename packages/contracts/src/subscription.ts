import { z } from "zod";

/**
 * Closed success outcomes of subscribing to somebody (Story 4.6, FR-46, AD-19).
 *
 * A subscription is created without confirmation, so the first request is
 * `SUBSCRIBED`. A repeat while the directed edge already exists is a
 * successful no-op (`ALREADY_SUBSCRIBED`), never an error: the client only has
 * to keep the button in its "подписан" state.
 */
export const SUBSCRIBE_OUTCOMES = [
  /** A new directed `Subscription(subscriberId, targetId)` row was inserted. */
  "SUBSCRIBED",
  /** The subscriber already follows the target; nothing was written. */
  "ALREADY_SUBSCRIBED",
] as const;

export const subscribeOutcomeSchema = z.enum(SUBSCRIBE_OUTCOMES);

export type SubscribeOutcome = (typeof SUBSCRIBE_OUTCOMES)[number];

/** Success payload of `POST /api/v1/u/:nick/subscription`. */
export const subscribeDataSchema = z.strictObject({
  outcome: subscribeOutcomeSchema,
});

export type SubscribeData = z.infer<typeof subscribeDataSchema>;

/**
 * Closed success outcomes of removing one directed subscription (Story 4.6,
 * AD-19). Both removal routes share this vocabulary: the subscriber's own
 * unsubscribe and the target removing a subscriber from their profile. A row
 * that is already gone is a successful no-op (`NOT_SUBSCRIBED`), so a second
 * tap never turns into an error.
 */
export const SUBSCRIPTION_REMOVAL_OUTCOMES = ["UNSUBSCRIBED", "NOT_SUBSCRIBED"] as const;

export const subscriptionRemovalOutcomeSchema = z.enum(SUBSCRIPTION_REMOVAL_OUTCOMES);

export type SubscriptionRemovalOutcome = (typeof SUBSCRIPTION_REMOVAL_OUTCOMES)[number];

/** Success payload of `DELETE /api/v1/u/:nick/subscription` and of `DELETE /api/v1/u/:nick/subscribers/:subscriberNick`. */
export const subscriptionRemovalDataSchema = z.strictObject({
  outcome: subscriptionRemovalOutcomeSchema,
});

export type SubscriptionRemovalData = z.infer<typeof subscriptionRemovalDataSchema>;
