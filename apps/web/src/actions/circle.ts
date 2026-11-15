import "server-only";

import {
  circleInvitesDataSchema,
  circlePageSchema,
  type ActionResult,
  type CircleCard,
  type CircleInvitesData,
  type CircleInvitesQuery,
  type CircleListQuery,
  type CirclePage,
} from "@gift-list/contracts";
import {
  readFriendsPage,
  readIncomingInvitesCount,
  readIncomingInvitesPage,
  readOutgoingInvitesPage,
  readSubscribersPage,
  readSubscriptionsPage,
  type CircleMember,
  type CirclePageResult,
} from "@/domain/circle";
import { auth } from "@/lib/auth";
import { circleReader } from "@/lib/circle-store";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * The domain refuses a cursor it did not issue with `VALIDATION` /
 * `INVALID_CURSOR` (Story 4.3.1). The wire keeps the established `VALIDATION`
 * shape of the query endpoints — `field` names the parameter, no new
 * `ERROR_REASONS` entry — so a client maps it like any other invalid query
 * value and the error vocabulary does not grow.
 */
function invalidCursor(field: "cursor" | "incomingCursor" | "outgoingCursor") {
  return {
    ok: false as const,
    code: "VALIDATION" as const,
    message: "Invalid cursor",
    field,
  };
}

/**
 * The one row of a circle list on the wire (Story 4.3.2). The domain member
 * carries `id` and `nameNormalized` for the cursor and the order only, so they
 * are dropped here; `followsViewer` becomes the camelCase `followsYou` of the
 * contract. No cooldown, email, `hideFromSearch` or wish field is added.
 */
function toCircleCard(member: CircleMember): CircleCard {
  return {
    displayName: member.displayName,
    nick: member.nick,
    relationship: member.relationship,
    subscribed: member.subscribed,
    followsYou: member.followsViewer,
  };
}

/** A domain page as the contract page: the cursor stays the opaque domain string. */
function toCirclePage(page: Extract<CirclePageResult, { ok: true }>): CirclePage {
  return circlePageSchema.parse({
    items: page.items.map(toCircleCard),
    nextCursor: page.nextCursor,
    total: page.total,
  });
}

function pageResult(
  result: CirclePageResult,
  field: "cursor" | "incomingCursor" | "outgoingCursor",
): ActionResult<CirclePage> {
  if (!result.ok) return invalidCursor(field);
  return { ok: true, data: toCirclePage(result) };
}

/**
 * Story 4.3 (AD-13): `GET /api/v1/me/friends`.
 *
 * The whole list — accepted friendships of the session user — is read by the
 * domain rule module through the Prisma adapter; this action only checks the
 * session, passes the normalized query and cursor through and maps the page to
 * the wire contract. An empty `q` is the whole circle, and `hideFromSearch` is
 * never applied: a friend is already in the viewer's circle (AD-13).
 */
export async function listFriends(
  input: CircleListQuery,
  headers: Headers,
): Promise<ActionResult<CirclePage>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const result = await readFriendsPage(circleReader, {
    viewerId: session.user.id,
    q: input.q,
    cursor: input.cursor,
  });
  return pageResult(result, "cursor");
}

/**
 * Story 4.3 (AD-19): `GET /api/v1/me/subscriptions` — the people the viewer
 * follows. It is a separate list from the subscribers, never one mixed page: a
 * directed subscription only counts in its own direction.
 *
 * The domain applies the same optional `q` predicate to every circle list, so a
 * `q` sent here filters this list instead of being silently ignored. The
 * screen never sends one; the endpoint stays consistent with the friends tab.
 */
export async function listSubscriptions(
  input: CircleListQuery,
  headers: Headers,
): Promise<ActionResult<CirclePage>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const result = await readSubscriptionsPage(circleReader, {
    viewerId: session.user.id,
    q: input.q,
    cursor: input.cursor,
  });
  return pageResult(result, "cursor");
}

/** Story 4.3 (AD-19): `GET /api/v1/me/subscribers` — who follows the viewer. */
export async function listSubscribers(
  input: CircleListQuery,
  headers: Headers,
): Promise<ActionResult<CirclePage>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const result = await readSubscribersPage(circleReader, {
    viewerId: session.user.id,
    q: input.q,
    cursor: input.cursor,
  });
  return pageResult(result, "cursor");
}

/**
 * Story 4.3 (AD-10): `GET /api/v1/me/invites` answers the «Запросы» tab in one
 * request: incoming and outgoing pending invites as two separate pages, each
 * paged by its own opaque cursor, plus the full number of incoming invites for
 * the badge.
 *
 * `incomingCount` comes from `readIncomingInvitesCount`, so it is the whole
 * incoming list after the block rule and never the size of the loaded page; it
 * does not depend on `incomingCursor`. All three reads share one parallel round
 * of the domain rules over the adapter.
 */
export async function listInvites(
  input: CircleInvitesQuery,
  headers: Headers,
): Promise<ActionResult<CircleInvitesData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const viewerId = session.user.id;
  const [incoming, outgoing, incomingCount] = await Promise.all([
    readIncomingInvitesPage(circleReader, { viewerId, cursor: input.incomingCursor }),
    readOutgoingInvitesPage(circleReader, { viewerId, cursor: input.outgoingCursor }),
    readIncomingInvitesCount(circleReader, viewerId),
  ]);

  if (!incoming.ok) return invalidCursor("incomingCursor");
  if (!outgoing.ok) return invalidCursor("outgoingCursor");

  return {
    ok: true,
    data: circleInvitesDataSchema.parse({
      incoming: toCirclePage(incoming),
      outgoing: toCirclePage(outgoing),
      incomingCount,
    }),
  };
}
