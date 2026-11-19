import "server-only";

import {
  formatDate,
  negotiateLocale,
  preferredFromAcceptLanguage,
  reservationActionBodySchema,
  reservationCardSchema,
  type ActionResult,
  type ReservationActionBody,
  type ReservationCard,
  type SupportedLocale,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Prisma } from "@/db/generated/client";
import {
  canExtendReservation,
  canSetReservationAttributes,
  type ReservationPhase,
} from "@/domain/gift-status";
import {
  toReservationCard,
  type ReservationCardRow,
} from "@/domain/reservation-card";
import {
  isDueOnInRange,
  maxReserveDueOn,
  reservationDueAtFromDueOn,
} from "@/domain/reservation-due";
import { firstIssueField } from "@/lib/api-v1";
import { auth } from "@/lib/auth";
import { runGiftStatusTransaction } from "@/lib/gift-status-store";
import { relationshipReader } from "@/lib/relationships";
import { canonicalTimeZone, storedTimeZone } from "@/lib/time-zone";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * Story 5.5 (AD-7, AD-12): one body for every refusal a non-holder can get. An
 * unknown id, a wish reserved by somebody else and a wish that was never
 * reserved are indistinguishable, so the route never hints that a reservation
 * existed or who holds it.
 */
const notFound = {
  ok: false as const,
  code: "NOT_FOUND" as const,
  message: "Gift not found",
};

/**
 * Story 5.5: the holder's own row is no longer a live reservation (the owner
 * closed or released it, or the extension lost to `GIVEN`) or two actions raced.
 * No `reason`: the client re-reads the list and shows what actually happened.
 */
const conflict = {
  ok: false as const,
  code: "CONFLICT" as const,
  message: "The reservation cannot be changed",
};

function validation(field?: string) {
  return {
    ok: false as const,
    code: "VALIDATION" as const,
    message: "Invalid input",
    ...(field ? { field } : {}),
  };
}

/** The columns the preflight and the lost-CAS re-read need; nothing else is read. */
const reservationUpdateSelect = {
  id: true,
  status: true,
  reservedById: true,
  reservationPhase: true,
} satisfies Prisma.GiftSelect;

/**
 * The closed card set plus the four fields `canOpenGift` decides on. Selecting
 * exactly these columns keeps price, tags, description, link, `listToken` and the
 * holder's own name out of the response (AD-7, AD-12).
 */
const reservationCardSelect = {
  id: true,
  status: true,
  title: true,
  titleSnapshotOnReserve: true,
  reservationDueAt: true,
  reservationTimeZone: true,
  reservationPhase: true,
  reservationBought: true,
  holderVisibleToOwner: true,
  holderVisibleToOthers: true,
  visibility: true,
  archivedAt: true,
  reservedById: true,
  list: { select: { ownerId: true, owner: { select: { nick: true } } } },
} satisfies Prisma.GiftSelect;

/** The row the preflight and the lost-CAS classification read. */
export type ReservationUpdateRow = {
  readonly status: "OPEN" | "RESERVED" | "CLOSED";
  readonly reservedById: string | null;
  readonly reservationPhase: ReservationPhase | null;
};

/**
 * Story 5.5: the one classification of a row for a `PATCH` of the holder.
 *
 * `NOT_FOUND` covers an unknown wish, a wish reserved by somebody else and a row
 * that already lost its holder — all three stay byte-identical, so the route
 * cannot be used to probe who holds what (AD-7, AD-12). `CONFLICT` is a
 * reservation of this actor that is not live anymore (the owner released or
 * closed the wish), and the same verdict stands for an extension that would leave
 * `GIVEN`, because that phase waits for the owner's confirmation (Story 5.7) and
 * an extension would silently restart its timers.
 *
 * The same function classifies the result of a lost CAS, so the preflight and the
 * race answer with one vocabulary.
 */
export function reservationUpdateResult(
  row: ReservationUpdateRow | null,
  actorId: string,
  action: ReservationActionBody["action"],
): "ok" | "NOT_FOUND" | "CONFLICT" {
  if (row === null) return "NOT_FOUND";
  if (row.reservedById !== actorId) return "NOT_FOUND";
  if (!canSetReservationAttributes(row)) return "CONFLICT";
  if (action === "extend" && !canExtendReservation(row)) return "CONFLICT";
  return "ok";
}

/**
 * The selected row on its way to the mapper: three reservation columns are
 * nullable in the database, and a `RESERVED` row without them is an anomaly the
 * caller skips instead of mapping.
 */
type StoredCardRow = Omit<
  ReservationCardRow,
  "reservationDueAt" | "reservationPhase" | "reservedById"
> & {
  readonly reservationDueAt: Date | null;
  readonly reservationPhase: ReservationPhase | null;
  readonly reservedById: string | null;
};

function reservationCardRow(row: StoredCardRow): ReservationCardRow | null {
  const { reservationDueAt, reservationPhase, reservedById } = row;
  if (
    reservationDueAt === null ||
    reservationPhase === null ||
    reservedById === null
  ) {
    return null;
  }
  return { ...row, reservationDueAt, reservationPhase, reservedById };
}

function requestLocale(headers: Headers): SupportedLocale {
  return negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
}

/**
 * Story 5.5 (FR-25, FR-29…FR-31, AD-7, AD-8, AD-9): one action per request on
 * the holder's own reservation — `extend`, `bought` or `visibility`. Every write
 * goes through `GiftStatusService`, the only writer of the reservation columns,
 * and the answer is the updated reservation card (not `{ id }`): an extension
 * changes the deadline, the phase and its moment at once, so the client replaces
 * the card instead of re-reading the list.
 *
 * Visibility, friendship and a block are deliberately not checked: after an
 * unfriend or a block the holder keeps control of the reservation (A-14), so the
 * action still passes and only `canOpenGift` on the returned card turns `false`.
 *
 * The status is never touched, so no audit line is written (NFR-6 audits a status
 * transition only; Story 5.5 has none). Notifications are Epic 6.
 */
export async function updateMyReservation(
  headers: Headers,
  giftId: string,
  body: unknown,
): Promise<ActionResult<ReservationCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const parsed = reservationActionBodySchema.safeParse(body);
  if (!parsed.success) return validation(firstIssueField(parsed.error));

  // A blank id cannot name a row; answer like an unknown one instead of querying.
  if (giftId.trim() === "") return notFound;

  const actorId = session.user.id;
  const stored = await prisma.gift.findFirst({
    where: { id: giftId },
    select: reservationUpdateSelect,
  });

  const verdict = reservationUpdateResult(stored, actorId, parsed.data.action);
  if (verdict === "NOT_FOUND") return notFound;
  if (verdict === "CONFLICT") return conflict;

  const now = new Date();
  let outcome: "success" | "lost";

  if (parsed.data.action === "extend") {
    // The chosen day is validated in the holder's own zone, exactly as in Story
    // 5.1: a fresh zone snapshot rides with the write, and `max` is the answer in
    // the request language.
    const { dueOn } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { id: actorId },
      select: { timeZone: true },
    });
    const timeZone = canonicalTimeZone(storedTimeZone(user?.timeZone) ?? null);

    if (!isDueOnInRange(dueOn, timeZone, now)) {
      const max = formatDate(maxReserveDueOn(timeZone, now), requestLocale(headers), {
        timeZone,
      });
      return {
        ok: false,
        code: "VALIDATION",
        message: "Due date out of range",
        reason: "DUE_OUT_OF_RANGE",
        params: { max },
      };
    }

    const dueAt = reservationDueAtFromDueOn(dueOn, timeZone);
    outcome = await runGiftStatusTransaction(function extendHolderReservation(service) {
      return service.extendReservation(giftId, actorId, { dueAt, timeZone, at: now });
    });
  } else if (parsed.data.action === "bought") {
    const { value } = parsed.data;
    outcome = await runGiftStatusTransaction(function setHolderBought(service) {
      return service.setReservationBought(giftId, actorId, { value });
    });
  } else {
    const { holderVisibleToOwner, holderVisibleToOthers } = parsed.data;
    outcome = await runGiftStatusTransaction(function setHolderVisibility(service) {
      return service.setReservationVisibility(giftId, actorId, {
        holderVisibleToOwner,
        holderVisibleToOthers,
      });
    });
  }

  if (outcome === "lost") {
    // The race is decided on a fresh read of the holder's own rows: gone means
    // NOT_FOUND, still there but not live means CONFLICT. Nothing was written.
    const after = await prisma.gift.findFirst({
      where: { id: giftId },
      select: reservationUpdateSelect,
    });
    return reservationUpdateResult(after, actorId, parsed.data.action) === "NOT_FOUND"
      ? notFound
      : conflict;
  }

  const fresh = await prisma.gift.findFirst({
    where: { id: giftId },
    select: reservationCardSelect,
  });
  if (fresh === null) return notFound;

  const row = reservationCardRow(fresh);
  if (row === null) {
    // A live reservation without a phase, a deadline or a holder is a data
    // anomaly: log the id only (never a title) and keep the failure invisible.
    console.warn(`reservation-update: incomplete reservation ${giftId}`);
    return notFound;
  }

  const relations = await relationshipReader.relationsBetween(actorId, fresh.list.ownerId);
  return {
    ok: true,
    data: reservationCardSchema.parse(toReservationCard(row, relations)),
  };
}
