import "server-only";

import type { ActionResult, ReservationCard, ReservationList } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Prisma } from "@/db/generated/client";
import {
  toReservationCard,
  type ReservationCardRow,
  type ReservationRelations,
} from "@/domain/reservation-card";
import { auth } from "@/lib/auth";
import { relationshipReader } from "@/lib/relationships";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * Story 5.5 (FR-25, A-14, AD-7/AD-12): exactly the columns a reservation card is
 * made of. No description, link, tags, `publicToken` or owner name comes back,
 * so the answer cannot turn into a second wishlist read. `visibility` and
 * `archivedAt` are read only to decide `canOpenGift`; `priceAmount` and
 * `priceCurrency` reach the card only while that gate stays open.
 */
const reservationSelect = {
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
  priceAmount: true,
  priceCurrency: true,
  reservedById: true,
  list: { select: { ownerId: true, owner: { select: { nick: true } } } },
} satisfies Prisma.GiftSelect;

type ReservationRow = Prisma.GiftGetPayload<{ select: typeof reservationSelect }>;

/** A row the mapper can read without guessing: all reservation columns present. */
type CompleteReservationRow = ReservationRow & {
  readonly reservedById: string;
  readonly reservationDueAt: Date;
  readonly reservationPhase: NonNullable<ReservationRow["reservationPhase"]>;
};

/** No relation facts is the safe default; it only ever closes the wish detail. */
const NO_RELATIONS: ReservationRelations = {
  blocked: false,
  friend: false,
  subscriber: false,
  contactMatch: false,
};

/**
 * «Мои брони» (A-14, FR-25): the caller's live reservations, read strictly by
 * `reservedById = actor` and `status = RESERVED`. The list deliberately does not
 * pass AD-7 and does not call `readWishlist`: after an unfriend or a block the
 * card must stay, while no other wish of the owner is ever read. `publicToken`
 * is not selected, so the list token cannot travel.
 *
 * `canOpenGift` is decided on the server with the same `VisibilityPolicy.canSee`
 * as the ordinary detail read, minus the list token (the card has none): a
 * friend, subscriber or contact match keeps the detail open, an unfriend, a
 * block, a narrowed `visibility` or a link-only reservation closes it. The
 * boolean never explains the cause.
 */
export async function getMyReservations(
  headers: Headers,
): Promise<ActionResult<ReservationList>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const actorId = session.user.id;
  const rows = await prisma.gift.findMany({
    where: {
      status: "RESERVED",
      reservedById: actorId,
      reservationDueAt: { not: null },
      reservationPhase: { not: null },
    },
    orderBy: [{ reservationDueAt: "asc" }, { id: "asc" }],
    select: reservationSelect,
  });

  // The query already filters the nullable columns, so a remaining gap is a data
  // anomaly. It is skipped with the row id only — no title, owner or other wish
  // data goes to the log.
  const complete: CompleteReservationRow[] = [];
  for (const row of rows) {
    if (isCompleteRow(row)) {
      complete.push(row);
    } else {
      console.warn("Incomplete reservation row skipped", row.id);
    }
  }

  // One relation lookup per distinct owner, not per card: two reservations at
  // the same wishlist must not ask the same three tables twice.
  const relationsByOwner = await loadRelations(actorId, complete);

  const reservations = complete.map(function toCard(row): ReservationCard {
    return toReservationCard(
      mapperRow(row),
      relationsByOwner.get(row.list.ownerId) ?? NO_RELATIONS,
    );
  });

  return { ok: true, data: { reservations } };
}

function isCompleteRow(row: ReservationRow): row is CompleteReservationRow {
  return (
    row.reservedById !== null &&
    row.reservationDueAt !== null &&
    row.reservationPhase !== null
  );
}

/** The card mapper reads exactly these fields; nothing else is selected. */
function mapperRow(row: CompleteReservationRow): ReservationCardRow {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    titleSnapshotOnReserve: row.titleSnapshotOnReserve,
    reservationDueAt: row.reservationDueAt,
    reservationTimeZone: row.reservationTimeZone,
    reservationPhase: row.reservationPhase,
    reservationBought: row.reservationBought,
    holderVisibleToOwner: row.holderVisibleToOwner,
    holderVisibleToOthers: row.holderVisibleToOthers,
    visibility: row.visibility,
    archivedAt: row.archivedAt,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    reservedById: row.reservedById,
    list: {
      ownerId: row.list.ownerId,
      owner: { nick: row.list.owner.nick },
    },
  };
}

async function loadRelations(
  actorId: string,
  rows: readonly CompleteReservationRow[],
): Promise<Map<string, ReservationRelations>> {
  const ownerIds = [...new Set(rows.map((row) => row.list.ownerId))];
  const entries = await Promise.all(
    ownerIds.map(async function load(ownerId) {
      const relations = await relationshipReader.relationsBetween(actorId, ownerId);
      return [ownerId, relations] as const;
    }),
  );
  return new Map(entries);
}
