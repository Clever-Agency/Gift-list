import "server-only";

import {
  USER_SEARCH_LIMIT,
  compareForSort,
  normalizeForSearch,
  userSearchDataSchema,
  type ActionResult,
  type UserSearchData,
  type UserSearchQuery,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Prisma } from "@/db/generated/client";
import { auth } from "@/lib/auth";
import { readProfileRelations, type PersonRelationFacts } from "@/lib/relationships";
import { requestLocale } from "@/lib/request-locale";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/** Only what a person row needs; wishes, email and the hidden flag are never read. */
type SearchRow = {
  id: string;
  name: string;
  nick: string;
};

/**
 * A `Block` in either direction removes the person from search entirely
 * (AD-7, EXPERIENCE.md L172): the row is absent, not merely marked, so a
 * blocked person cannot be found, invited or opened from the search screen.
 *
 * Both halves are relation filters, so Prisma renders them as `NOT EXISTS`
 * subqueries inside the single `SELECT` of each bucket — never a query per
 * card, and never a second round-trip after the rows are fetched.
 */
function notBlockedWithViewer(viewerId: string): Prisma.UserWhereInput {
  return {
    // The candidate blocked the viewer.
    blocksMade: { none: { blockedId: viewerId } },
    // The viewer blocked the candidate.
    blocksReceived: { none: { blockerId: viewerId } },
  };
}

/**
 * Story 3.5 (AD-13, AD-27, FR-6, FR-8, NFR-3): a signed-in user finds anybody
 * by nick (exact or prefix) or by display name (fuzzy, any substring).
 *
 * The query is compared only in the `normalizeForSearch()` form: NFC, lower
 * case, `ё → е`, `й` stays `й`. The database keeps that form in
 * `User.nickNormalized` / `User.nameNormalized`; a handful of rows is fetched
 * per bucket, not the whole table. `hideFromSearch = true` and a `Block` in
 * either direction are filtered in SQL, so a hidden or blocked person is absent
 * from this answer while `/u/:nick` and `/l/:token` keep working (AD-7).
 *
 * An empty query and a query with no matches both answer `ok: true` with an
 * empty `users` array — the empty state of FR-6, never an error. A card carries
 * `{ displayName, nick }`, the viewer's closed relation to that person (Story
 * 4.1.2, 4.2.2) and, since Story 4.6, the independent `subscribed` flag: the same
 * facts the profile buttons read, so the search screen needs no per-card profile
 * request and never touches wishes (NFR-3). The relation comes from the profile
 * readers and never from a second set of friendship rules; the viewer's own card
 * is `NONE` / `false`. An exact nick comes first, then nick prefixes, then
 * display-name matches: the documents do not fix the order of these buckets, so
 * this ranking is the one the screen receives.
 */
export async function searchUsers(
  input: UserSearchQuery,
  headers: Headers,
): Promise<ActionResult<UserSearchData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const query = normalizeForSearch(input.q.trim());
  if (query === "") return { ok: true, data: { users: [] } };

  const [byNick, byDisplayName] = await Promise.all([
    prisma.user.findMany({
      where: {
        hideFromSearch: false,
        nickNormalized: { startsWith: query },
        ...notBlockedWithViewer(session.user.id),
      },
      select: { id: true, name: true, nick: true },
      orderBy: { nickNormalized: "asc" },
      take: USER_SEARCH_LIMIT,
    }),
    prisma.user.findMany({
      where: {
        hideFromSearch: false,
        nameNormalized: { contains: query },
        ...notBlockedWithViewer(session.user.id),
      },
      select: { id: true, name: true, nick: true },
      orderBy: { nameNormalized: "asc" },
      take: USER_SEARCH_LIMIT,
    }),
  ]);

  const rows = mergeSearchRows(byNick, byDisplayName, query);
  const locale = requestLocale(headers.get("accept-language"));
  const page = rankSearchRows(rows, query, locale).slice(0, USER_SEARCH_LIMIT);
  // One flat batch for the whole page (CLE-70 / F3): the relation, the
  // rejection cooldown and the subscription are read for every id at once, so
  // the number of queries never grows with the number of cards. An empty page
  // asks nothing.
  const facts =
    page.length === 0
      ? new Map<string, PersonRelationFacts>()
      : await readProfileRelations(
          session.user.id,
          page.map((row) => row.id),
        );
  const users = page.map(function toCard(row) {
    return {
      displayName: row.name,
      nick: row.nick,
      ...(facts.get(row.id) ?? { relationship: "NONE", subscribed: false }),
    };
  });
  return { ok: true, data: userSearchDataSchema.parse({ users }) };
}

/**
 * Merges the two buckets without duplicates. The pure predicate is repeated
 * here, so a `LIKE` wildcard in the query cannot smuggle in a row and the answer
 * stays a real prefix/substring match. Ranking and the
 * {@link USER_SEARCH_LIMIT} cap happen after the merge, so an exact nick is
 * never pushed out by a longer list of weaker matches.
 */
function mergeSearchRows(
  byNick: readonly SearchRow[],
  byDisplayName: readonly SearchRow[],
  query: string,
): SearchRow[] {
  const seen = new Set<string>();
  const rows: SearchRow[] = [];
  for (const row of [...byNick, ...byDisplayName]) {
    if (seen.has(row.id)) continue;
    const matchesNick = normalizeForSearch(row.nick).startsWith(query);
    const matchesDisplayName = normalizeForSearch(row.name).includes(query);
    if (!matchesNick && !matchesDisplayName) continue;
    seen.add(row.id);
    rows.push(row);
  }
  return rows;
}

/**
 * The order of the answer: an exact nick first, then nick prefixes, then
 * display-name matches. Neither `epics.md` nor the PRD fixes the order of these
 * buckets, so this ranking is the one the search screen gets. Within the prefix
 * and display-name buckets the locale-aware `compareForSort` orders cards, so
 * equal relevance still reads alphabetically.
 */
function rankSearchRows(rows: readonly SearchRow[], query: string, locale: string): SearchRow[] {
  const exact: SearchRow[] = [];
  const prefix: SearchRow[] = [];
  const byDisplayName: SearchRow[] = [];

  for (const row of rows) {
    const nickNormalized = normalizeForSearch(row.nick);
    if (nickNormalized === query) exact.push(row);
    else if (nickNormalized.startsWith(query)) prefix.push(row);
    else byDisplayName.push(row);
  }

  function byName(left: SearchRow, right: SearchRow) {
    return (
      compareForSort(locale, left.name, right.name) ||
      compareForSort(locale, left.nick, right.nick)
    );
  }

  prefix.sort(byName);
  byDisplayName.sort(byName);
  return [...exact, ...prefix, ...byDisplayName];
}
