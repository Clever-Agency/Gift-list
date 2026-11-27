// AD-23 (Story 7.5, FR-38/FR-43) — who gets a personal date and who gets its
// year. Rules only: no Prisma, no React/Next.js here (AD-1). The caller gathers
// the viewer identity, the stored row and the relation facts from outside; this
// module only decides whether the date and its year travel.
import type {
  DateVisibility,
  PersonalDate,
  VisiblePersonalDate,
} from "@gift-list/contracts";
import type { ViewerRelations } from "./visibility";

/** The person asking for a profile; `null` is an anonymous visitor. */
export type PersonalDateViewer = { readonly id: string } | null;

/**
 * The stored row plus the one fact this policy needs from the platform: whose
 * date it is. Everything else is the viewer's relation to that owner, passed as
 * {@link ViewerRelations} — the same set the wishlist gate reads (AD-7, AD-10,
 * AD-18, AD-19).
 */
export type PersonalDateStored = VisiblePersonalDate & {
  readonly ownerId: string;
  readonly visibility: DateVisibility;
  readonly yearVisibility: DateVisibility;
};

/**
 * AD-23: the owner always sees every own date. A block in either direction
 * hides all of them (the profile itself is already the closed `NOT_FOUND`
 * before this rule runs, so a blocked pair has no answer to widen or narrow).
 * `/l/:token` never carries dates, so a list-token visit always answers `false`
 * even when the owner picked «все».
 *
 * `ONLY_ME` is the owner alone. `FRIENDS` needs an accepted `Friendship`.
 * `EVERYONE` is any viewer of the profile — an anonymous visitor on `/u/:nick`,
 * a subscriber, a contact match, a friend or a signed-in stranger.
 */
export function canSeePersonalDate(
  viewer: PersonalDateViewer,
  relations: ViewerRelations,
  date: PersonalDateStored,
): boolean {
  if (viewer !== null && viewer.id === date.ownerId) return true;
  if (relations.blocked) return false;
  if (relations.viaListToken) return false;

  if (date.visibility === "ONLY_ME") return false;
  if (date.visibility === "FRIENDS") return viewer !== null && relations.friend;
  return true;
}

/**
 * AD-23: the year travels only to somebody who sees the date itself **and** is
 * allowed by `yearVisibility`. «Все» on the date never opens the year by itself,
 * because the year is a separate switch with its own default «только я». A date
 * without a year has nothing to open, whoever asks.
 */
export function canSeePersonalDateYear(
  viewer: PersonalDateViewer,
  relations: ViewerRelations,
  date: PersonalDateStored,
): boolean {
  if (date.year === null) return false;
  if (!canSeePersonalDate(viewer, relations, date)) return false;
  if (viewer !== null && viewer.id === date.ownerId) return true;

  if (date.yearVisibility === "ONLY_ME") return false;
  if (date.yearVisibility === "FRIENDS") return viewer !== null && relations.friend;
  return true;
}

/** The owner's own row: every stored field, visibility switches included. */
export function toPersonalDate(date: PersonalDateStored): PersonalDate {
  return {
    id: date.id,
    kind: date.kind,
    title: date.title,
    day: date.day,
    month: date.month,
    year: date.year,
    visibility: date.visibility,
    yearVisibility: date.yearVisibility,
  };
}

/**
 * One date as another viewer gets it, or `undefined` when the viewer may not see
 * it. A hidden year becomes `null` — the same value as "no year", so a closed
 * year never reveals that the owner stored one.
 */
export function personalDateFor(
  viewer: PersonalDateViewer,
  relations: ViewerRelations,
  date: PersonalDateStored,
): VisiblePersonalDate | undefined {
  if (!canSeePersonalDate(viewer, relations, date)) return undefined;

  return {
    id: date.id,
    kind: date.kind,
    title: date.title,
    day: date.day,
    month: date.month,
    year: canSeePersonalDateYear(viewer, relations, date) ? date.year : null,
  };
}

/** Visible dates of one profile, in the order the caller read them. */
export function visiblePersonalDates(
  viewer: PersonalDateViewer,
  relations: ViewerRelations,
  dates: readonly PersonalDateStored[],
): VisiblePersonalDate[] {
  const visible: VisiblePersonalDate[] = [];
  for (const date of dates) {
    const row = personalDateFor(viewer, relations, date);
    if (row !== undefined) visible.push(row);
  }
  return visible;
}
