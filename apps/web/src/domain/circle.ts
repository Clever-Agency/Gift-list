// AD-10 / AD-13 / Story 4.3 — the reads of the viewer's own circle. Rules only:
// no Prisma, no React/Next.js here (AD-1). The caller hands over a `CircleReader`
// and the Prisma adapter in `lib/circle-store.ts` owns every table lookup.
//
// The circle is the viewer's graph as it is stored: accepted friendships, the
// directed subscriptions the viewer made (`Я подписан`) and received (`Мои
// подписчики`), and the pending invites of both directions (AD-19, AD-10).
// This module, not the adapter, owns the rules of every list, so the domain tests
// and production run the same code:
//
// - a `Block` in either direction removes the person from every list (AD-10 step
//   4). The reader reports the fact, the rules drop the row;
// - search compares only through `normalizeForSearch()` (AD-13, AD-27) and covers
//   the whole circle before the page is cut, never the loaded page;
// - a page is {@link CIRCLE_PAGE_SIZE} rows ordered by the stable pair
//   (`nameNormalized`, `id`). Plain string comparison, never `Intl.Collator`: the
//   cursor must mean the same thing in every locale;
// - `hideFromSearch` is a global-search flag (AD-13) and is deliberately not read
//   here. A friend is already in the viewer's circle, so the flag changes nothing.

import { normalizeForSearch, type ProfileRelationship } from "@gift-list/contracts";

/** One page of every circle list (Story 4.3, AD-13). */
export const CIRCLE_PAGE_SIZE = 15;

/**
 * The stable sort and cursor key of one person: `nameNormalized` first, then the
 * CUID2 `id`. Two friends may share a display name, and the pair still orders
 * them and pages them without a row being skipped or repeated.
 */
export type CircleCursor = {
  readonly nameNormalized: string;
  readonly id: string;
};

/**
 * One person of a circle list — only what a row shows. `relationship` and the
 * two directed subscription facts are what the friend actions of Story 4.3.2
 * read next to the row; wishes, email, nick tokens and `hideFromSearch` never
 * travel here (NFR-3).
 */
export type CircleMember = {
  readonly id: string;
  readonly displayName: string;
  readonly nick: string;
  readonly nameNormalized: string;
  readonly relationship: ProfileRelationship;
  /** The viewer follows this person (`Subscription` viewer → person). */
  readonly subscribed: boolean;
  /** This person follows the viewer (`Subscription` person → viewer). */
  readonly followsViewer: boolean;
};

/** What the reader answers: a member plus the one fact the rules filter on. */
export type CircleCandidate = CircleMember & { readonly blocked: boolean };

/** One page of a circle list. `total` is the full count after the filters. */
export type CirclePage = {
  readonly items: readonly CircleMember[];
  readonly nextCursor: string | null;
  /** The «N из M» denominator: the whole filtered list, not the page. */
  readonly total: number;
};

/**
 * A page, or the closed refusal of a cursor that this module did not issue. The
 * cursor is opaque, so a mangled one is a `VALIDATION` answer for Story 4.3.2 and
 * never a silent restart from the first row.
 */
export type CirclePageResult =
  | ({ readonly ok: true } & CirclePage)
  | { readonly ok: false; readonly code: "VALIDATION"; readonly reason: "INVALID_CURSOR" };

/**
 * The queries of the circle (Story 4.3). Every list is answered from the stored
 * edges, and a `Block` still arrives flagged so the domain can drop it. The
 * counterpart of an invite row is the person the row is about, not the invite
 * row itself: the lists only need people and their order key.
 *
 * Reads never take the friendship pair lock: they are not part of the write
 * protocol of a pair (AD-10 step 2 is about writes only).
 */
export interface CircleReader {
  /** Accepted `Friendship` edges with the viewer on either side. */
  readFriends(viewerId: string): Promise<readonly CircleCandidate[]>;
  /** Directed `Subscription(viewerId → target)`: the people the viewer follows. */
  readSubscriptions(viewerId: string): Promise<readonly CircleCandidate[]>;
  /** Directed `Subscription(subscriber → viewerId)`: the viewer's subscribers. */
  readSubscribers(viewerId: string): Promise<readonly CircleCandidate[]>;
  /** Pending `FriendshipInvite(from → viewerId)`, one row per inviter. */
  readIncomingInvites(viewerId: string): Promise<readonly CircleCandidate[]>;
  /** Pending `FriendshipInvite(viewerId → to)`, one row per recipient. */
  readOutgoingInvites(viewerId: string): Promise<readonly CircleCandidate[]>;
}

/** The query every circle list accepts; only the friends tab sends `q`. */
export type CirclePageQuery = {
  readonly viewerId: string;
  /** The «Искать среди друзей» field of Story 4.3 (AD-13). */
  readonly q?: string;
  /** The `nextCursor` of the previous page, or `null`/absent for the first one. */
  readonly cursor?: string | null;
};

const INVALID_CURSOR = {
  ok: false,
  code: "VALIDATION",
  reason: "INVALID_CURSOR",
} as const;

/** Ids are CUID2, so they never contain the separator; display names may. */
const CURSOR_SEPARATOR = "|";

/**
 * The comparison form of the «Искать среди друзей» field (AD-13, AD-27): trim,
 * drop one optional leading `@`, then `normalizeForSearch()` — NFC, lower case,
 * `ё → е`, `й` stays `й`. An empty answer means the whole circle: blanks and a
 * lone `@` are not a search.
 */
export function normalizeFriendQuery(raw: string): string {
  const trimmed = raw.trim();
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return normalizeForSearch(withoutAt);
}

/**
 * A nick match is exact or a prefix, a display-name match is fuzzy (any
 * substring), and either one is enough. Only the `normalizeForSearch()` form is
 * compared, so «Алена» finds «Алёна» while «иога» does not find «Йога».
 * `hideFromSearch` never reaches this predicate: the circle is not the global
 * search of AD-13.
 */
export function friendMatchesQuery(
  member: Pick<CircleMember, "nick" | "nameNormalized">,
  rawQuery: string,
): boolean {
  const query = normalizeFriendQuery(rawQuery);
  if (query === "") return true;
  return normalizeForSearch(member.nick).startsWith(query) || member.nameNormalized.includes(query);
}

/**
 * The one order of every circle list: `nameNormalized` ASC, then `id` ASC. Plain
 * code-unit comparison, so the page and its cursor do not depend on a locale;
 * `Intl.Collator` / `compareForSort` must not be used as this key.
 */
export function compareCircleOrder(left: CircleCursor, right: CircleCursor): number {
  if (left.nameNormalized !== right.nameNormalized) {
    return left.nameNormalized < right.nameNormalized ? -1 : 1;
  }
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

/**
 * The opaque `nextCursor`. It is the {@link CircleCursor} pair only, split at the
 * last separator so a display name containing one still decodes.
 */
export function encodeCircleCursor(cursor: CircleCursor): string {
  return `${cursor.nameNormalized}${CURSOR_SEPARATOR}${cursor.id}`;
}

/** `null` for anything this module did not issue: no id half, no cursor. */
export function decodeCircleCursor(value: string): CircleCursor | null {
  const separator = value.lastIndexOf(CURSOR_SEPARATOR);
  if (separator < 0) return null;
  const id = value.slice(separator + 1);
  if (id === "") return null;
  return { nameNormalized: value.slice(0, separator), id };
}

/** The row a page carries: a candidate of a visible person, without its facts. */
function toCircleMember(candidate: CircleCandidate): CircleMember {
  return {
    id: candidate.id,
    displayName: candidate.displayName,
    nick: candidate.nick,
    nameNormalized: candidate.nameNormalized,
    relationship: candidate.relationship,
    subscribed: candidate.subscribed,
    followsViewer: candidate.followsViewer,
  };
}

/**
 * The shared pipeline of every list: drop blocked pairs, apply the search to the
 * whole circle, order by the stable pair, then cut one cursor page. `total` is
 * counted after the filters and before the cursor, so «N из M» of the friends
 * tab never changes while paging.
 */
function buildCirclePage(
  candidates: readonly CircleCandidate[],
  input: Omit<CirclePageQuery, "viewerId">,
): CirclePageResult {
  const visible = candidates.filter(function notBlocked(row) {
    return !row.blocked;
  });
  const matched = visible.filter(function matchesSearch(row) {
    return friendMatchesQuery(row, input.q ?? "");
  });
  const total = matched.length;

  const rawCursor = input.cursor ?? null;
  let cursor: CircleCursor | null = null;
  if (rawCursor !== null && rawCursor !== "") {
    cursor = decodeCircleCursor(rawCursor);
    if (cursor === null) return INVALID_CURSOR;
  }

  const ordered = [...matched].sort(compareCircleOrder);
  const rest =
    cursor === null
      ? ordered
      : ordered.filter(function afterCursor(row) {
          return compareCircleOrder(row, cursor) > 0;
        });
  const items = rest.slice(0, CIRCLE_PAGE_SIZE);
  const nextCursor =
    rest.length > CIRCLE_PAGE_SIZE
      ? encodeCircleCursor(items[items.length - 1])
      : null;

  return { ok: true, items: items.map(toCircleMember), nextCursor, total };
}

/**
 * The «Друзья» tab (Story 4.3, AD-13): accepted friendships of the viewer, the
 * optional search over the whole list, and one cursor page of
 * {@link CIRCLE_PAGE_SIZE}. An empty query and a query with no matches both
 * answer successfully with a full or an empty page.
 */
export async function readFriendsPage(
  reader: CircleReader,
  query: CirclePageQuery,
): Promise<CirclePageResult> {
  return buildCirclePage(await reader.readFriends(query.viewerId), query);
}

/**
 * The «Подписки · Я подписан» list: the viewer's own directed subscriptions
 * (AD-19). A subscription is not a friendship and never becomes one.
 */
export async function readSubscriptionsPage(
  reader: CircleReader,
  query: CirclePageQuery,
): Promise<CirclePageResult> {
  return buildCirclePage(await reader.readSubscriptions(query.viewerId), query);
}

/** The «Подписки · Мои подписчики» list: who follows the viewer (AD-19). */
export async function readSubscribersPage(
  reader: CircleReader,
  query: CirclePageQuery,
): Promise<CirclePageResult> {
  return buildCirclePage(await reader.readSubscribers(query.viewerId), query);
}

/** The «Запросы» incoming half (AD-10): invites addressed to the viewer. */
export async function readIncomingInvitesPage(
  reader: CircleReader,
  query: CirclePageQuery,
): Promise<CirclePageResult> {
  return buildCirclePage(await reader.readIncomingInvites(query.viewerId), query);
}

/** The «Запросы» outgoing half (AD-10): invites the viewer sent and may cancel. */
export async function readOutgoingInvitesPage(
  reader: CircleReader,
  query: CirclePageQuery,
): Promise<CirclePageResult> {
  return buildCirclePage(await reader.readOutgoingInvites(query.viewerId), query);
}

/**
 * The badge of the «Запросы» tab: the whole number of incoming invites, not the
 * size of the loaded page and not a page-limited counter. A blocked inviter does
 * not count, exactly like the list itself.
 */
export async function readIncomingInvitesCount(
  reader: CircleReader,
  viewerId: string,
): Promise<number> {
  const incoming = await reader.readIncomingInvites(viewerId);
  return incoming.filter(function notBlocked(row) {
    return !row.blocked;
  }).length;
}
