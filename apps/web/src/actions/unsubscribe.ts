import "server-only";

import { setReminderSwitch } from "@/lib/notification-store";
import { verifyUnsubscribeToken, type UnsubscribeType } from "@/lib/unsubscribe-token";

/**
 * CLE-137 (Story 7.2, FR-36): what the `/unsubscribe/{token}` page and the
 * RFC 8058 one-click route may do. A token turns its own type switch off or
 * back on and touches nothing else: no session, no account data, no channels.
 *
 * `ok: false` is one answer for a forgery and for a deleted account, so the
 * page stays neutral about whether the user exists. An idempotent repeat (the
 * switch is already off or on) is a success: the caller cannot tell.
 */
export type UnsubscribeResult =
  | { ok: true; type: UnsubscribeType; enabled: boolean }
  | { ok: false };

export async function applyUnsubscribe(
  token: string,
  enabled: boolean,
): Promise<UnsubscribeResult> {
  const payload = verifyUnsubscribeToken(token);
  if (payload === null) return { ok: false };

  const { count } = await setReminderSwitch(payload.userId, payload.type, enabled);
  if (count === 0) return { ok: false };
  return { ok: true, type: payload.type, enabled };
}
