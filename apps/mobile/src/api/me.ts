import { meSchema, type Me } from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

/**
 * Story 3.1: the nick change answers with the current user, so the settings
 * screen can put it into `AuthContext` without a reload. The payload is
 * re-checked with the shared contract (AD-12) like the gift clients: a body
 * that does not match is `invalid`, not a broken connection.
 */
export type NickResult =
  | { ok: true; data: Me }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 3.1 (AD-13): `PUT /api/v1/me/nick` changes the nick; the server
 * normalizes it the same way as registration, so the body is sent as typed.
 */
export async function updateNick(nick: string): Promise<NickResult> {
  const result = await apiRequest<unknown>("/api/v1/me/nick", {
    method: "PUT",
    body: { nick },
  });
  if (!result.ok) return result;

  const parsed = meSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, data: parsed.data };
}
