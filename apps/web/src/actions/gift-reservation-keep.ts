import "server-only";

import {
  giftCardSchema,
  keepReservationBodySchema,
  type ActionResult,
  type GiftCard,
} from "@gift-list/contracts";
import type { z } from "zod";
import { prisma } from "@/db/client";
import type { Prisma } from "@/db/generated/client";
import {
  canKeepReservation,
  keptReservationDueAt,
  type ReservationPhaseRow,
} from "@/domain/gift-status";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";
import { firstIssueField } from "@/lib/api-v1";
import { auth } from "@/lib/auth";
import { runGiftStatusTransaction } from "@/lib/gift-status-store";
import { canonicalTimeZone } from "@/lib/time-zone";
import {
  archivedValidation,
  notFound,
  ownerGiftSelect,
  requestLocale,
  unauthenticated,
} from "@/actions/gifts";

/**
 * Story 5.6 (AD-7): the owner's own row that is no longer waiting for an answer —
 * the timer released it, the holder extended it, or the wish closed. No `reason`:
 * the client re-reads the list and shows what actually happened.
 */
const conflict = {
  ok: false as const,
  code: "CONFLICT" as const,
  message: "The reservation cannot be kept",
};

function validation(field?: string) {
  return {
    ok: false as const,
    code: "VALIDATION" as const,
    message: "Invalid input",
    ...(field ? { field } : {}),
  };
}

/**
 * Story 5.6: the body is a strict empty object, so the usual `firstIssueField`
 * has no path to name — a smuggled key is reported as an `unrecognized_keys`
 * issue instead. The envelope then carries the offending key as `field`, so the
 * client can point at it without a second schema.
 */
function validationField(error: z.ZodError): string | undefined {
  const field = firstIssueField(error);
  if (field !== undefined) return field;
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys" && issue.keys.length > 0) return issue.keys[0];
  }
  return undefined;
}

/**
 * The columns the keep decides on: the phase rules, the archive flag and the
 * zone snapshot the new deadline is counted in. `bought` is deliberately absent —
 * keep never changes it and the predicate does not look at it.
 */
const keepSelect = {
  id: true,
  status: true,
  archivedAt: true,
  reservationPhase: true,
  reservationTimeZone: true,
  list: { select: { ownerId: true } },
} satisfies Prisma.GiftSelect;

/** The row {@link keepReservationResult} classifies; ownership narrows it first. */
export type KeepReservationRow = ReservationPhaseRow & {
  /** The holder's zone snapshot the new deadline is counted in; never written back. */
  readonly reservationTimeZone: string | null;
  readonly list: { readonly ownerId: string };
};

/**
 * Story 5.6 (AD-7, AD-8): the one classification of a row for the owner's keep.
 *
 * `NOT_FOUND` covers an unknown wish and somebody else's wish — both stay
 * byte-identical, so the route cannot be used to probe what exists (AD-7). An
 * archived wish of the owner is read-only and answers the archived reason
 * (AD-8). Every other phase or a status that is not `RESERVED` is `CONFLICT`.
 *
 * The same function classifies a lost CAS, so the preflight and the race answer
 * with one vocabulary.
 */
export function keepReservationResult(
  row: KeepReservationRow | null,
  actorId: string,
): "ok" | "NOT_FOUND" | "ARCHIVED" | "CONFLICT" {
  if (row === null) return "NOT_FOUND";
  if (row.list.ownerId !== actorId) return "NOT_FOUND";
  if (row.archivedAt !== null) return "ARCHIVED";
  return canKeepReservation(row) ? "ok" : "CONFLICT";
}

/**
 * Story 5.6 (FR-25, FR-31, AD-7, AD-9, ARCH-A14): the owner answers «Не получал,
 * оставить бронь» on a reservation that waits in `AWAITING_OWNER`. The keep moves
 * the phase back to `ACTIVE`, records its moment and puts the deadline on the end
 * of «today + 7» in the zone saved with the reservation. The zone snapshot, the
 * holder's `bought` mark and `status` are not touched.
 *
 * The answer is the owner card, not `{ id }`: it already carries `ownerAction`,
 * which is `null` after a keep, so the client replaces the card instead of
 * re-reading the whole list. The card adds no reservation facts (`dueAt`,
 * `phase`, `bought`) — the owner does not see them (AD-7).
 *
 * A lost CAS is re-read inside the owner's own list: a gone row is `NOT_FOUND`,
 * an existing row is `CONFLICT`. Notifications are Epic 6: the transition is
 * reported by the one seam (`RESERVATION_KEPT_BY_OWNER`), which the CAS method
 * emits after the commit.
 */
export async function keepReservation(
  headers: Headers,
  giftId: string,
  body: unknown,
): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const parsed = keepReservationBodySchema.safeParse(body);
  if (!parsed.success) return validation(validationField(parsed.error));

  const actorId = session.user.id;
  const stored = await prisma.gift.findFirst({
    where: { id: giftId, list: { ownerId: actorId } },
    select: keepSelect,
  });

  const verdict = keepReservationResult(stored, actorId);
  if (verdict === "NOT_FOUND") return notFound;
  if (verdict === "ARCHIVED") return archivedValidation;
  if (verdict === "CONFLICT") return conflict;
  // `verdict === "ok"` proved the row exists; the narrow keeps the type honest.
  if (stored === null) return notFound;

  const now = new Date();
  const dueAt = keptReservationDueAt(now, canonicalTimeZone(stored.reservationTimeZone));

  const outcome = await runGiftStatusTransaction(function keepOwnerReservation(service) {
    return service.keepReservationByOwner(giftId, actorId, { dueAt, at: now });
  });

  if (outcome === "lost") {
    // Only a gone row is NOT_FOUND; anything else that moved is CONFLICT.
    const after = await prisma.gift.findFirst({
      where: { id: giftId, list: { ownerId: actorId } },
      select: { id: true },
    });
    return after === null ? notFound : conflict;
  }

  const row = await prisma.gift.findFirst({
    where: { id: giftId, list: { ownerId: actorId } },
    select: ownerGiftSelect,
  });
  if (!row) return notFound;

  return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row, requestLocale(headers))) };
}
