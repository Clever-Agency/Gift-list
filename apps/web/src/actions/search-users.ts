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
 * never revealed by search (NFR-3).
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
  rows.sort(function byDisplayName(left, right) {
    return (
      compareForSort(locale, left.name, right.name) ||
      compareForSort(locale, left.nick, right.nick)
    );
  });

  const users = rows.map(function toCard(row) {
    return { displayName: row.name, nick: row.nick };
  });
  return { ok: true, data: userSearchDataSchema.parse({ users }) };
}

/**
 * Merges the two buckets without duplicates and keeps at most
 * {@link USER_SEARCH_LIMIT} cards. Nick matches come first, because an exact or
 * prefix nick is the most precise answer; display-name matches then fill the
 * rest. The pure predicate is repeated here, so a `LIKE` wildcard in the query
 * cannot smuggle in a row and the answer stays a real prefix/substring match.
 */
function mergeSearchRows(
  byNick: readonly SearchRow[],
  byDisplayName: readonly SearchRow[],
  query: string,
): SearchRow[] {
  const seen = new Set<string>();
  const rows: SearchRow[] = [];
  for (const row of [...byNick, ...byDisplayName]) {
    if (rows.length >= USER_SEARCH_LIMIT) break;
    if (seen.has(row.id)) continue;
    const matchesNick = normalizeForSearch(row.nick).startsWith(query);
    const matchesDisplayName = normalizeForSearch(row.name).includes(query);
    if (!matchesNick && !matchesDisplayName) continue;
    seen.add(row.id);
    rows.push(row);
  }
  return rows;
}
