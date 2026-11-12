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
import { auth } from "@/lib/auth";
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
 * Story 3.5 (AD-13, AD-27, FR-6, FR-8, NFR-3): a signed-in user finds anybody
 * by nick (exact or prefix) or by display name (fuzzy, any substring).
 *
 * The query is compared only in the `normalizeForSearch()` form: NFC, lower
 * case, `ё → е`, `й` stays `й`. The database keeps that form in
 * `User.nickNormalized` / `User.nameNormalized`; a handful of rows is fetched
 * per bucket, not the whole table. `hideFromSearch = true` is filtered in SQL,
 * so a hidden person is absent from this answer while `/u/:nick` and `/l/:token`
 * keep working (AD-7).
 *
 * An empty query and a query with no matches both answer `ok: true` with an
 * empty `users` array — the empty state of FR-6, never an error. The answer
 * carries only `{ displayName, nick }` cards: the wishlist composition is
 * never revealed by search (NFR-3). An exact nick comes first, then nick
 * prefixes, then display-name matches: the documents do not fix the order of
 * these buckets, so this ranking is the one the screen receives.
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
      where: { hideFromSearch: false, nickNormalized: { startsWith: query } },
      select: { id: true, name: true, nick: true },
      orderBy: { nickNormalized: "asc" },
      take: USER_SEARCH_LIMIT,
    }),
    prisma.user.findMany({
      where: { hideFromSearch: false, nameNormalized: { contains: query } },
      select: { id: true, name: true, nick: true },
      orderBy: { nameNormalized: "asc" },
      take: USER_SEARCH_LIMIT,
    }),
  ]);

  const rows = mergeSearchRows(byNick, byDisplayName, query);
  const locale = requestLocale(headers.get("accept-language"));
  const users = rankSearchRows(rows, query, locale)
    .slice(0, USER_SEARCH_LIMIT)
    .map(function toCard(row) {
      return { displayName: row.name, nick: row.nick };
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
