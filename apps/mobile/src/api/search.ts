import { userSearchDataSchema, type UserSearchCard } from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";
import { prepareUserSearchQuery } from "@/search/search-query";

/** A failed search: the transport/envelope, or a body outside the shared contract. */
export type UserSearchResult =
  | { ok: true; users: UserSearchCard[] }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 3.5 (FR-6, AD-13, AD-27): `GET /api/v1/search?q=...` through the shared
 * `apiRequest` transport (cookie on the web, bearer on the phone). The server
 * already leaves `hideFromSearch` people out and decides the order; the client
 * only checks the AD-12 answer with the shared contract.
 *
 * The query is encoded and loses its optional leading `@` (`DESIGN.md` →
 * SearchField: «Имя или @ник»). The screen never calls this with an empty
 * query: an empty field is the «до ввода» state, not an API request.
 */
export async function searchUsers(query: string): Promise<UserSearchResult> {
  const q = prepareUserSearchQuery(query);
  const result = await apiRequest<unknown>(`/api/v1/search?q=${encodeURIComponent(q)}`);
  if (!result.ok) return result;

  const parsed = userSearchDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, users: parsed.data.users };
}
