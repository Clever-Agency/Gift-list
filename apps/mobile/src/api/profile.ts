import { listDataSchema, type GiftCard } from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";
import { profileRoute } from "@/profile/profile-route";

/** The two owner fields a nick read may name (Story 3.4.1). */
export type ProfileOwner = {
  readonly displayName: string;
  readonly nick: string;
};

/**
 * The profile read has three outcomes: a named profile, the closed `not_found`
 * gate, or a failed request. A found profile without the owner block is treated
 * as the same closed gate, like the link screen, so the app never renders an
 * unnamed profile the server did not describe.
 */
export type ProfileResult =
  | { ok: true; access: "gifts"; gifts: GiftCard[]; owner: ProfileOwner }
  | { ok: true; access: "not_found" }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 3.4 / AD-7, AD-12: `GET /api/v1/u/:nick` through the shared
 * `apiRequest` transport (cookie on the web, bearer on the phone). The server
 * applies `VisibilityPolicy`; the client only checks the AD-12 envelope and
 * never filters wishes by visibility on its own. A malformed segment is the
 * same `not_found` before a request, matching the server route.
 */
export async function fetchProfile(nick: string): Promise<ProfileResult> {
  const route = profileRoute(nick);
  if (route === null) return { ok: true, access: "not_found" };

  const result = await apiRequest<unknown>(`/api/v1/u/${encodeURIComponent(route.nick)}`);
  if (!result.ok) return result;

  const parsed = listDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  if (parsed.data.access === "not_found") return { ok: true, access: "not_found" };
  if (parsed.data.owner === undefined) return { ok: true, access: "not_found" };

  return {
    ok: true,
    access: "gifts",
    gifts: parsed.data.gifts,
    owner: parsed.data.owner,
  };
}
