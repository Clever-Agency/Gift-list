import { subscribeToNick, unsubscribeFromNick } from "@/api/subscription";
import { mutationErrorMessage } from "@/session/form-issue";

/** The one subscription press the profile shows. */
export type SubscriptionAction = "subscribe" | "unsubscribe";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * The closed answer of one subscription press. The screen owns its optimistic
 * state; this helper only turns the transport answer, the two successful
 * outcomes and the error codes into one vocabulary, so the button never reads
 * a raw code. Both repeat outcomes are successes: `ALREADY_SUBSCRIBED` and
 * `NOT_SUBSCRIBED` keep the requested state instead of failing.
 */
export type SubscriptionAnswer =
  | { status: "subscribed" }
  | { status: "unsubscribed" }
  | { status: "expired" }
  | { status: "missing" }
  | { status: "failed"; message: string };

export async function requestSubscriptionAction(
  kind: SubscriptionAction,
  nick: string,
  copy: { profile: Translate; common: Translate },
): Promise<SubscriptionAnswer> {
  const result =
    kind === "subscribe" ? await subscribeToNick(nick) : await unsubscribeFromNick(nick);

  if (result.ok) {
    return kind === "subscribe" ? { status: "subscribed" } : { status: "unsubscribed" };
  }

  if ("network" in result) {
    return { status: "failed", message: copy.profile("subscription.network") };
  }
  if ("invalid" in result) {
    return { status: "failed", message: copy.common("errors.generic") };
  }
  if (result.code === "UNAUTHENTICATED") return { status: "expired" };
  if (result.code === "NOT_FOUND") return { status: "missing" };

  return { status: "failed", message: mutationErrorMessage(result, copy.common) };
}
