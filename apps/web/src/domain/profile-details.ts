// AD-7 (ред. 2026-11-26, D-58, FR-54, FR-55) / AD-29 — who gets somebody's
// profile fields. Rules only: no Prisma, no React/Next.js here (AD-1). The
// caller gathers the identity, the stored row and the one relation fact from
// outside; this module only decides whether the fields travel.
import type { Gender, ProfileDetails, VisibleProfileDetails } from "@gift-list/contracts";

/** The person asking for the profile; `null` is an anonymous visitor. */
export type ProfileDetailsViewer = { readonly id: string } | null;

/** The owner of the profile and the single switch that opens the fields. */
export type ProfileDetailsOwner = {
  readonly id: string;
  readonly profileVisibleToFriends: boolean;
};

/**
 * The only relation fact the profile gate reads: an accepted `Friendship`.
 * A subscription, a contact match and a `/l/:token` visit are deliberately not
 * part of this type, so no caller can widen the rule by passing them.
 */
export type ProfileDetailsRelations = { readonly friend: boolean };

/** The stored values; the switch is not part of what another viewer sees. */
export type ProfileDetailsRow = {
  readonly birthDay: number | null;
  readonly birthMonth: number | null;
  readonly gender: Gender | null;
  readonly country: string | null;
  readonly about: string | null;
};

/**
 * AD-7 / AD-29: the owner always sees their own fields; an accepted friend sees
 * them only while the owner's `profileVisibleToFriends` is on. Everybody else —
 * a subscriber, a link visitor, a contact match, a stranger, an anonymous
 * visitor — never does. A `Block` in either direction is already the closed
 * HTTP 404 `NOT_FOUND` before this rule runs (AD-7 step 2), so it is not a fact
 * here: a blocked profile has no answer to widen or narrow.
 */
export function canSeeProfileDetails(
  viewer: ProfileDetailsViewer,
  owner: ProfileDetailsOwner,
  relations: ProfileDetailsRelations,
): boolean {
  if (viewer === null) return false;
  if (viewer.id === owner.id) return true;
  return relations.friend && owner.profileVisibleToFriends;
}

/** The five fields as the owner stored them, without the switch. */
export function toVisibleProfileDetails(row: ProfileDetailsRow): VisibleProfileDetails {
  return {
    birthDay: row.birthDay,
    birthMonth: row.birthMonth,
    gender: row.gender,
    country: row.country,
    about: row.about,
  };
}

/**
 * The `details` block of `/u/:nick`, or `undefined` when the viewer may not see
 * it. `undefined` becomes an absent key, not a `null` stub: a hidden profile
 * must not reveal that the owner filled anything in. The switch travels only in
 * the owner's own answer, next to their fields.
 */
export function profileDetailsFor(
  viewer: ProfileDetailsViewer,
  owner: ProfileDetailsOwner,
  relations: ProfileDetailsRelations,
  row: ProfileDetailsRow,
): ProfileDetails | undefined {
  if (!canSeeProfileDetails(viewer, owner, relations)) return undefined;

  const details = toVisibleProfileDetails(row);
  if (viewer !== null && viewer.id === owner.id) {
    return { ...details, profileVisibleToFriends: owner.profileVisibleToFriends };
  }
  return details;
}
