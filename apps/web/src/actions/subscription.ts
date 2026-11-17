import "server-only";

import type {
  ActionResult,
  SubscribeData,
  SubscriptionRemovalData,
} from "@gift-list/contracts";
import { removeSubscription, subscribeToUser } from "@/domain/subscription";
import { auth } from "@/lib/auth";
import { findUserIdByNick } from "@/lib/find-user-by-nick";
import { subscriptionStore } from "@/lib/subscription-store";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/** Unknown, old or malformed nick: the same closed answer, without a name. */
const notFound = {
  ok: false as const,
  code: "NOT_FOUND" as const,
  message: "Not found",
};

/**
 * Self-subscription, a Block in either direction and a stranger managing
 * somebody else's subscribers share one closed refusal (AD-12, AD-19), exactly
 * like the neighbour invite mutations.
 */
const forbidden = {
  ok: false as const,
  code: "FORBIDDEN" as const,
  message: "Forbidden",
};

/**
 * Story 4.6 (FR-46, AD-19): a signed-in user subscribes to the owner of the
 * nick's profile. The target is exactly one nick path segment; the body is not
 * read at all, so an arbitrary user id can never select another person.
 *
 * A subscription is created without confirmation and is not a friendship: the
 * domain protocol only writes the directed `Subscription` row, so `FRIENDS`
 * wishes stay closed (AD-7, D-31). A repeat is the successful no-op
 * `ALREADY_SUBSCRIBED`.
 */
export async function subscribeByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<SubscribeData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const targetId = await findUserIdByNick(nick);
  if (targetId === null) return notFound;

  const result = await subscribeToUser(
    { subscriberId: session.user.id, targetId },
    subscriptionStore,
  );
  if (!result.ok) {
    // The domain refusal carries SELF_SUBSCRIPTION/BLOCKED for tests; the wire
    // keeps one closed FORBIDDEN answer and never says which one happened.
    return forbidden;
  }

  return { ok: true, data: { outcome: result.outcome } };
}

/**
 * Story 4.6 (AD-19): the subscriber removes their own directed edge to the
 * nick's owner. The session user is the subscriber, so neither the body nor
 * another user id can choose the row.
 *
 * A row that is already gone is the successful no-op `NOT_SUBSCRIBED`, never an
 * error; the removal does not read a Block, so a block can never keep a stale
 * subscription alive.
 */
export async function unsubscribeByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<SubscriptionRemovalData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const targetId = await findUserIdByNick(nick);
  if (targetId === null) return notFound;

  const result = await removeSubscription(
    { subscriberId: session.user.id, targetId },
    subscriptionStore,
  );
  if (!result.ok) return forbidden;

  return { ok: true, data: { outcome: result.outcome } };
}

/**
 * Story 4.6 (AD-19): the owner of the nick's profile removes one subscriber by
 * the subscriber's nick. This is a mutation of one directed row, never a list:
 * Story 4.3 owns the subscriber list and no read is added here.
 *
 * The actor must be the profile owner. That check runs before the subscriber
 * nick is resolved, so a stranger cannot probe nicks through this route; an
 * unknown owner nick and an unknown subscriber nick both answer the same closed
 * `NOT_FOUND`. A repeat is the successful no-op `NOT_SUBSCRIBED`.
 */
export async function removeSubscriberByNick(
  nick: string,
  subscriberNick: string,
  headers: Headers,
): Promise<ActionResult<SubscriptionRemovalData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = await findUserIdByNick(nick);
  if (ownerId === null) return notFound;
  if (ownerId !== session.user.id) return forbidden;

  const subscriberId = await findUserIdByNick(subscriberNick);
  if (subscriberId === null) return notFound;

  const result = await removeSubscription(
    { subscriberId, targetId: ownerId },
    subscriptionStore,
  );
  if (!result.ok) return forbidden;

  return { ok: true, data: { outcome: result.outcome } };
}
