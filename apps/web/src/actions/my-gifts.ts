import "server-only";

import {
  listDataSchema,
  type ActionResult,
  type GiftCard,
  type ListData,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { VisibilityPolicy, type GiftVisibility } from "@/domain/visibility";
import { auth } from "@/lib/auth";

/** Plain row the owner mapper reads; keeps Prisma types out of the mapping rules. */
type OwnerGiftRow = {
  id: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: GiftCard["priceCurrency"];
  linkUrl: string | null;
  visibility: GiftVisibility;
  quantity: GiftCard["quantity"];
  expiresOn: Date | null;
  archivedAt: Date | null;
  status: GiftCard["status"];
  reservationPhase: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  holderVisibleToOwner: boolean;
  reservedBy: { id: string; nick: string; name: string } | null;
};

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * AD-7 owner branch: the caller's own wishlist. Every visibility, including
 * `SECRET`, comes back; archived gifts stay out of the active list (AD-8) until
 * the archive section of Story 2.6. Shared by the app screen and any `api/v1`
 * adapter — the policy is the only gate, so no raw `findMany` by `listId` bypasses it.
 */
export async function getMyGifts(headers: Headers): Promise<ActionResult<ListData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = session.user.id;
  // AD-6 creates the list at registration; a missing row is an anomaly, and an
  // empty wishlist is safer on the owner's own screen than a gate error.
  const list = await prisma.list.findUnique({ where: { ownerId }, select: { id: true } });
  if (!list) return { ok: true, data: { access: "gifts", gifts: [] } };

  const rows = await prisma.gift.findMany({
    where: { listId: list.id, archivedAt: null },
    // Newest wish first; `id` keeps the order stable for equal timestamps.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      priceAmount: true,
      priceCurrency: true,
      linkUrl: true,
      visibility: true,
      quantity: true,
      expiresOn: true,
      archivedAt: true,
      status: true,
      reservationPhase: true,
      holderVisibleToOwner: true,
      reservedBy: { select: { id: true, nick: true, name: true } },
    },
  });

  const viewer = { id: ownerId };
  const gifts = rows
    .filter((row) => VisibilityPolicy.resolve(viewer, { ownerId, visibility: row.visibility }).visible)
    .map(toOwnerGiftCard);

  return { ok: true, data: listDataSchema.parse({ access: "gifts", gifts }) };
}

/**
 * Owner gift card (AD-7 read matrix, AD-12): no holder identity unless the holder
 * allowed it, no `bought`, `dueAt` or reservation label; the owner action comes
 * from the reservation phase instead. Tags arrive with Story 2.5.
 */
function toOwnerGiftCard(row: OwnerGiftRow): GiftCard {
  const reservation = row.status === "RESERVED" ? row : null;
  const holder = reservation?.holderVisibleToOwner ? reservation.reservedBy : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    linkUrl: row.linkUrl,
    visibility: row.visibility,
    quantity: row.quantity,
    expiresOn: calendarDay(row.expiresOn),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    tags: [],
    status: row.status,
    reservedBy: holder
      ? { id: holder.id, nick: holder.nick, displayName: holder.name }
      : null,
    reservationLabel: null,
    ownerAction: ownerAction(row),
  };
}

/** The owner answers a finished reservation only while it is still open (AD-7). */
function ownerAction(row: OwnerGiftRow): GiftCard["ownerAction"] {
  if (row.status !== "RESERVED") return null;
  switch (row.reservationPhase) {
    case "AWAITING_OWNER":
      return "EXPIRED_NO_REPLY";
    case "GIVEN":
      return "CONFIRM_GIVEN";
    default:
      return null;
  }
}

/** `Gift.expiresOn` is a date column; the wire keeps a plain ISO calendar day. */
function calendarDay(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
