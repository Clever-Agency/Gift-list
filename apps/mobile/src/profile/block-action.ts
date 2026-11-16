import { blockUser } from "@/api/block";
import { mutationErrorMessage } from "@/session/form-issue";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Story 4.5: the closed answer of one block press. `BLOCKED` and the idempotent
 * `ALREADY_BLOCKED` are both successes, like the unfriend pair of Story 4.4, so a
 * repeat never reads as an error. The server cuts the friendship, both
 * subscriptions and the pending invites of the pair in one transaction (AD-10
 * step 4) and keeps the reservations (A-14); the screens only own their rows.
 */
export type BlockAnswer =
  | { status: "blocked" }
  | { status: "expired" }
  | { status: "missing" }
  | { status: "failed"; message: string };

export async function requestBlock(
  nick: string,
  copy: { profile: Translate; common: Translate },
): Promise<BlockAnswer> {
  const result = await blockUser(nick);

  if (result.ok) return { status: "blocked" };

  if ("network" in result) {
    return { status: "failed", message: copy.profile("relationship.network") };
  }
  if ("invalid" in result) {
    return { status: "failed", message: copy.common("errors.generic") };
  }
  if (result.code === "UNAUTHENTICATED") return { status: "expired" };
  if (result.code === "NOT_FOUND") return { status: "missing" };

  return { status: "failed", message: mutationErrorMessage(result, copy.common) };
}
