import {
  circleInvitesDataSchema,
  circlePageSchema,
  friendCancelDataSchema,
  friendRemoveDataSchema,
  subscriptionRemovalDataSchema,
  type CircleInvitesData,
  type CirclePage,
  type FriendCancelOutcome,
  type FriendRemoveOutcome,
  type SubscriptionRemovalOutcome,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";
import { profileRoute } from "@/profile/profile-route";
import { prepareUserSearchQuery } from "@/search/search-query";

/** A circle read that passed the shared contract, or why it did not. */
export type CirclePageResult =
  | { ok: true; page: CirclePage }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/** Both halves of «Запросы» and the incoming badge count (Story 4.3, AD-10). */
export type CircleInvitesResult =
  | { ok: true; invites: CircleInvitesData }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

type OutcomeResult<T extends string> =
  | { ok: true; outcome: T }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/** Story 4.3: the sender withdrew their own pending invite. */
export type FriendCancelResult = OutcomeResult<FriendCancelOutcome>;

/** Story 4.4: either side removed the accepted friendship, a repeat is a no-op. */
export type FriendRemoveResult = OutcomeResult<FriendRemoveOutcome>;

/** Story 4.3: the profile owner removed one subscriber, a repeat is a no-op. */
export type RemoveSubscriberResult = OutcomeResult<SubscriptionRemovalOutcome>;

/**
 * One query string of a circle read. An absent or blank `q` is the whole list,
 * not an empty search: the parameter is left out, exactly like the domain reads
 * it (Story 4.3.1). The cursor is opaque and only travels back as the server
 * issued it.
 */
function circleQuery(parameters: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(parameters)) {
    if (value === undefined || value === "") continue;
    parts.push(`${name}=${encodeURIComponent(value)}`);
  }
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

/**
 * Story 4.3 (FR-15, AD-13): one page of a circle list through the shared
 * `apiRequest` transport. The server has already filtered by AD-7 and sorted;
 * the client only checks the AD-12 answer against `circlePageSchema`.
 */
async function fetchCirclePage(
  path: string,
  parameters: Record<string, string | undefined>,
): Promise<CirclePageResult> {
  const result = await apiRequest<unknown>(`${path}${circleQuery(parameters)}`);
  if (!result.ok) return result;

  const parsed = circlePageSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, page: parsed.data };
}

/**
 * `GET /api/v1/me/friends?q=&cursor=`: the viewer's friends, one page of 15.
 * `q` searches the whole circle by name or nick (the `@` is optional), not only
 * the rows already loaded — the server does that filtering (Story 4.3.2).
 */
export function fetchFriends(query = "", cursor?: string): Promise<CirclePageResult> {
  return fetchCirclePage("/api/v1/me/friends", {
    q: prepareUserSearchQuery(query),
    cursor,
  });
}

/** `GET /api/v1/me/subscriptions?cursor=`: the people the viewer follows. */
export function fetchSubscriptions(cursor?: string): Promise<CirclePageResult> {
  return fetchCirclePage("/api/v1/me/subscriptions", { cursor });
}

/** `GET /api/v1/me/subscribers?cursor=`: the people who follow the viewer. */
export function fetchSubscribers(cursor?: string): Promise<CirclePageResult> {
  return fetchCirclePage("/api/v1/me/subscribers", { cursor });
}

/**
 * `GET /api/v1/me/invites?incomingCursor=&outgoingCursor=`: both pending halves
 * and the full incoming count for the «Запросы» badge. The count is not a page
 * and does not depend on the cursor.
 */
export async function fetchInvites(
  incomingCursor?: string,
  outgoingCursor?: string,
): Promise<CircleInvitesResult> {
  const result = await apiRequest<unknown>(
    `/api/v1/me/invites${circleQuery({
      incomingCursor,
      outgoingCursor,
    })}`,
  );
  if (!result.ok) return result;

  const parsed = circleInvitesDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, invites: parsed.data };
}

/**
 * Story 4.3.2: one DELETE to the invite segment of exactly one nick. The body is
 * not sent: the target is the nick in the path. A malformed segment is rejected
 * before a request, like the profile read and the server route.
 */
export async function cancelFriendInvite(nick: string): Promise<FriendCancelResult> {
  const route = profileRoute(nick);
  if (route === null) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    `/api/v1/u/${encodeURIComponent(route.nick)}/invite`,
    { method: "DELETE" },
  );
  if (!result.ok) return result;

  const parsed = friendCancelDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, outcome: parsed.data.outcome };
}

/**
 * Story 4.4 (FR-23, AD-10 step 4): either side of an accepted friendship removes
 * it. One DELETE to the `friend` segment of exactly one nick; the body is not
 * sent, because the target is the nick in the path. A malformed segment is
 * rejected before a request, like the profile read and the server route. The
 * friendship is undirected, so the caller passes the former friend's nick
 * whichever side they are; both closed outcomes are successful answers.
 */
export async function removeFriend(nick: string): Promise<FriendRemoveResult> {
  const route = profileRoute(nick);
  if (route === null) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    `/api/v1/u/${encodeURIComponent(route.nick)}/friend`,
    { method: "DELETE" },
  );
  if (!result.ok) return result;

  const parsed = friendRemoveDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, outcome: parsed.data.outcome };
}

/**
 * Story 4.6 / 4.3: the profile owner removes one subscriber. `:nick` is the
 * owner — the session user, so the caller passes their own nick — and `:subscriberNick`
 * is the person whose subscription goes away. The body is not read.
 */
export async function removeSubscriber(
  ownerNick: string,
  subscriberNick: string,
): Promise<RemoveSubscriberResult> {
  const owner = profileRoute(ownerNick);
  const subscriber = profileRoute(subscriberNick);
  if (owner === null || subscriber === null) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    `/api/v1/u/${encodeURIComponent(owner.nick)}/subscribers/${encodeURIComponent(subscriber.nick)}`,
    { method: "DELETE" },
  );
  if (!result.ok) return result;

  const parsed = subscriptionRemovalDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, outcome: parsed.data.outcome };
}
