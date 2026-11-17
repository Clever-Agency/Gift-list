import {
  subscribeDataSchema,
  subscriptionRemovalDataSchema,
  type SubscribeOutcome,
  type SubscriptionRemovalOutcome,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";
import { profileRoute } from "@/profile/profile-route";

type OutcomeResult<T extends string> =
  | { ok: true; outcome: T }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 4.6 (FR-46, AD-19): the closed subscribe answer. `ALREADY_SUBSCRIBED`
 * is a successful no-op, not an error, so a second tap never shows a failure.
 */
export type SubscribeResult = OutcomeResult<SubscribeOutcome>;

/**
 * Story 4.6: the closed unsubscribe answer. `NOT_SUBSCRIBED` is the same kind
 * of successful no-op for an edge that is already gone.
 */
export type UnsubscribeResult = OutcomeResult<SubscriptionRemovalOutcome>;

/** The closed success envelope both subscription mutations answer with. */
type OutcomeSchema<T extends string> = {
  safeParse: (
    value: unknown,
  ) => { success: true; data: { outcome: T } } | { success: false };
};

/**
 * One request to `/api/v1/u/:nick/subscription`: `POST` subscribes the session
 * user to the nick's owner and `DELETE` removes that same directed row. The
 * body is not sent, because the target is exactly the nick in the path. A
 * malformed segment is rejected before a request, like the profile read and
 * the server route.
 */
async function subscriptionRequest<T extends string>(
  nick: string,
  method: "POST" | "DELETE",
  schema: OutcomeSchema<T>,
): Promise<OutcomeResult<T>> {
  const route = profileRoute(nick);
  if (route === null) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    `/api/v1/u/${encodeURIComponent(route.nick)}/subscription`,
    { method },
  );
  if (!result.ok) return result;

  const parsed = schema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, outcome: parsed.data.outcome };
}

/** Story 4.6: subscribe to the nick's owner without their confirmation. */
export function subscribeToNick(nick: string): Promise<SubscribeResult> {
  return subscriptionRequest(nick, "POST", subscribeDataSchema);
}

/** Story 4.6: remove the viewer's own subscription to the nick's owner. */
export function unsubscribeFromNick(nick: string): Promise<UnsubscribeResult> {
  return subscriptionRequest(nick, "DELETE", subscriptionRemovalDataSchema);
}
