import type { GiftCard } from "@gift-list/contracts";

/**
 * D-49 (CLE-124): the owner never learns about a reservation, so the warning
 * before «Изменить», «Удалить» and a visibility narrowing is decided only by what
 * the owner already sees — the wish status and its visibility. No reservation
 * field ever reaches this file.
 *
 * The three questions share one subject: an open wish (`OPEN`, or the stale
 * `RESERVED` answer of an old server that the owner sees as open) that is not
 * `SECRET` and is not in the archive. Only such a wish can have been reserved and
 * can lose a holder, so only it gets the neutral warning.
 */
export type SurpriseWarningSubject = {
  status: GiftCard["status"];
  visibility: GiftCard["visibility"];
  /** Archive is a third fact of the same owner-facing state, not a reservation sign. */
  archivedAt?: string | null;
};

/** `SECRET` is the narrowest circle: a smaller rank is a narrowing. */
const VISIBILITY_RANK: Record<GiftCard["visibility"], number> = {
  SECRET: 0,
  FRIENDS: 1,
  PUBLIC: 2,
};

/** `PUBLIC→FRIENDS`, `PUBLIC→SECRET`, `FRIENDS→SECRET`. Equal or wider is not. */
export function isVisibilityNarrowing(
  from: GiftCard["visibility"],
  to: GiftCard["visibility"],
): boolean {
  return VISIBILITY_RANK[to] < VISIBILITY_RANK[from];
}

/** Whether «Изменить» or «Удалить» asks the neutral question first. */
export function needsSurpriseWarning(subject: SurpriseWarningSubject): boolean {
  return (
    (subject.status === "OPEN" || subject.status === "RESERVED") &&
    subject.visibility !== "SECRET" &&
    (subject.archivedAt ?? null) === null
  );
}

/**
 * Whether the save of the form asks before writing a new visibility. A wish that
 * already is `SECRET` cannot narrow further, and an unchanged value is a no-op,
 * so both stay silent.
 */
export function needsVisibilityWarning(
  subject: SurpriseWarningSubject,
  to: GiftCard["visibility"],
): boolean {
  return needsSurpriseWarning(subject) && isVisibilityNarrowing(subject.visibility, to);
}
