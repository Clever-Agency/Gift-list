import {
  friendInviteDataSchema,
  type FriendInviteOutcome,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";
import { profileRoute } from "@/profile/profile-route";

/**
 * Story 4.1.2 / AD-10, AD-12: the same closed outcome set the instance returns.
 * `PENDING` and `ALREADY_FRIENDS` are successful no-ops, not errors.
 */
export type FriendInviteResult =
  | { ok: true; outcome: FriendInviteOutcome }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 4.1.3: send an invite to the owner of exactly one nick segment. The
 * route is the same for a first invite and for accepting an incoming one — the
 * domain auto-accepts a reverse pending invite (AD-10, ARCH-A12), so the screen
 * never needs a separate Story 4.2 endpoint.
 *
 * The body is not sent: the target is only the nick in the path, mirroring the
 * server adapter. A malformed segment is rejected before a request, like the
 * profile read and the server route.
 */
export async function sendFriendInvite(nick: string): Promise<FriendInviteResult> {
  const route = profileRoute(nick);
  if (route === null) return { ok: false, invalid: true };

  const result = await apiRequest<unknown>(
    `/api/v1/u/${encodeURIComponent(route.nick)}/invite`,
    { method: "POST" },
  );
  if (!result.ok) return result;

  const parsed = friendInviteDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, outcome: parsed.data.outcome };
}
