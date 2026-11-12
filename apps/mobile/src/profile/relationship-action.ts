import type { ProfileInviteCooldown, ProfileRelationship } from "@gift-list/contracts";
import {
  acceptFriendInvite,
  rejectFriendInvite,
  sendFriendInvite,
} from "@/api/friend-invite";
import { mutationErrorMessage } from "@/session/form-issue";

/** The three relation presses the profile and the search row both show. */
export type RelationshipAction = "add" | "accept" | "reject";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The optimistic relation and cooldown a press writes until the server answers. */
export type OptimisticRelation = {
  relationship: ProfileRelationship;
  inviteCooldown: ProfileInviteCooldown | null;
};

/**
 * Story 4.1.3 / 4.2.3: the optimistic state of one press. Accept gives a
 * friendship, add waits for an answer, and reject leaves no edge but writes the
 * 24-hour window in the same transaction (AD-10 step 3). A profile reread
 * replaces the estimated hours with the server's whole number; a search row
 * keeps them, because the invite answer carries no profile (NFR-3).
 */
export function optimisticRelation(kind: RelationshipAction): OptimisticRelation {
  if (kind === "accept") return { relationship: "FRIENDS", inviteCooldown: null };
  if (kind === "reject") {
    return { relationship: "NONE", inviteCooldown: { hours: 24, rejected: false } };
  }
  return { relationship: "OUTGOING_PENDING", inviteCooldown: null };
}

/**
 * The closed answer of one relation press, read from the same invite client the
 * profile uses. The screens own their state transitions; this helper only turns
 * the transport answer, the success outcomes and the error codes into one
 * vocabulary, so `/u/:nick` and `/search` cannot drift apart.
 */
export type RelationshipAnswer =
  | { status: "friends" }
  | { status: "pending" }
  | { status: "rejected"; inviteCooldown: ProfileInviteCooldown }
  | {
      status: "cooldown";
      message: string;
      /** The server's remaining hours when it named them; otherwise `null`. */
      inviteCooldown: ProfileInviteCooldown | null;
    }
  | { status: "expired" }
  | { status: "missing" }
  | { status: "failed"; message: string };

export async function requestRelationshipAction(
  kind: RelationshipAction,
  nick: string,
  copy: { relationship: Translate; common: Translate },
): Promise<RelationshipAnswer> {
  const result =
    kind === "reject"
      ? await rejectFriendInvite(nick)
      : kind === "accept"
        ? await acceptFriendInvite(nick)
        : await sendFriendInvite(nick);

  if (result.ok) {
    if (kind === "reject") {
      const cooldown = optimisticRelation("reject").inviteCooldown;
      // `optimisticRelation` always names the window for a reject.
      return { status: "rejected", inviteCooldown: cooldown ?? { hours: 24, rejected: false } };
    }
    if (result.outcome === "FRIENDS_CREATED" || result.outcome === "ALREADY_FRIENDS") {
      return { status: "friends" };
    }
    // `INVITED` and the `PENDING` no-op both leave an outgoing invite.
    return { status: "pending" };
  }

  if ("network" in result) {
    return { status: "failed", message: copy.relationship("relationship.network") };
  }
  if ("invalid" in result) {
    return { status: "failed", message: copy.common("errors.generic") };
  }
  if (result.code === "UNAUTHENTICATED") return { status: "expired" };
  if (result.code === "NOT_FOUND") return { status: "missing" };

  // A stale screen can still offer the button while the server already holds
  // the rejection window. The closed reason carries the remaining hours, so the
  // toast uses the catalogue phrase instead of the generic rate-limit text. A
  // malformed `hours` still proves the window, but only the reason text shows.
  if (result.code === "RATE_LIMITED" && result.reason === "INVITE_COOLDOWN") {
    const hours = result.params?.hours;
    const valid = typeof hours === "number" && Number.isInteger(hours) && hours >= 1;
    return {
      status: "cooldown",
      message: valid
        ? copy.common("errors.reason.INVITE_COOLDOWN", { hours })
        : copy.common("errors.code.RATE_LIMITED"),
      inviteCooldown: valid ? { hours, rejected: false } : null,
    };
  }

  return { status: "failed", message: mutationErrorMessage(result, copy.common) };
}
