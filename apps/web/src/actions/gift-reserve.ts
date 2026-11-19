import "server-only";

import {
  formatDate,
  giftCardSchema,
  giftReserveBodySchema,
  negotiateLocale,
  preferredFromAcceptLanguage,
  type ActionResult,
  type GiftCard,
  type SupportedLocale,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Prisma } from "@/db/generated/client";
import { canReserveGift, type ReserveEligibleRow } from "@/domain/gift-status";
import {
  isDueOnInRange,
  maxReserveDueOn,
  reservationDueAtFromDueOn,
} from "@/domain/reservation-due";
import { toViewerGiftCard } from "@/domain/viewer-gift-card";
import { VisibilityPolicy } from "@/domain/visibility";
import { firstIssueField } from "@/lib/api-v1";
import { auth } from "@/lib/auth";
import { giftStatusTransaction } from "@/lib/gift-status-store";
import { canonicalTimeZone, storedTimeZone } from "@/lib/time-zone";
import { relationshipReader } from "@/lib/relationships";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

const notFound = {
  ok: false as const,
  code: "NOT_FOUND" as const,
  message: "Gift not found",
};

const forbidden = {
  ok: false as const,
  code: "FORBIDDEN" as const,
  message: "Cannot reserve own gift",
};

const reserveSelect = {
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
  reservationDueAt: true,
  reservationTimeZone: true,
  reservationBought: true,
  holderVisibleToOwner: true,
  holderVisibleToOthers: true,
  // Story 5.3: the viewer card does not expose it, but the row type is shared.
  closedAt: true,
  reservedBy: { select: { id: true, nick: true, name: true } },
  tags: {
    select: { tagId: true, customText: true, tag: { select: { labels: true, slug: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  list: { select: { ownerId: true, publicToken: true } },
} satisfies Prisma.GiftSelect;

/** The list link is a capability the caller already holds; a mismatch stays invisible. */
function arrivedViaList(listToken: string | null | undefined, publicToken: string): boolean {
  return typeof listToken === "string" && listToken.length > 0 && listToken === publicToken;
}

function requestLocale(headers: Headers): SupportedLocale {
  return negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
}

function validation(field?: string) {
  return {
    ok: false as const,
    code: "VALIDATION" as const,
    message: "Invalid input",
    ...(field ? { field } : {}),
  };
}

/**
 * Story 5.1 (FR-17, AD-8, AD-9): a signed-in non-owner reserves a visible SINGLE
 * wish through the only writer of reservation columns.
 */
export async function reserveGift(
  headers: Headers,
  giftId: string,
  body: unknown,
  listToken?: string | null,
): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const parsed = giftReserveBodySchema.safeParse(body);
  if (!parsed.success) return validation(firstIssueField(parsed.error));

  const row = await prisma.gift.findFirst({
    where: { id: giftId },
    select: reserveSelect,
  });
  if (!row) return notFound;

  const ownerId = row.list.ownerId;
  if (ownerId === session.user.id) return forbidden;

  const relations = {
    ...(await relationshipReader.relationsBetween(session.user.id, ownerId)),
    viaListToken: arrivedViaList(listToken, row.list.publicToken),
  };

  const visible = VisibilityPolicy.canSee({ id: session.user.id }, relations, {
    ownerId,
    visibility: row.visibility,
    archivedAt: row.archivedAt,
  });
  if (!visible) return notFound;

  const statusRow: ReserveEligibleRow = {
    status: row.status,
    quantity: row.quantity,
    archivedAt: row.archivedAt,
  };

  if (row.quantity === "UNLIMITED") {
    return validation();
  }

  if (row.status === "CLOSED") {
    return { ok: false, code: "CONFLICT", message: "Gift is closed" };
  }

  if (row.status === "RESERVED") {
    if (row.reservedBy?.id === session.user.id) {
      const card = toViewerGiftCard(row, session.user.id, requestLocale(headers));
      return { ok: true, data: giftCardSchema.parse(card) };
    }
    return {
      ok: false,
      code: "CONFLICT",
      message: "Already reserved",
      reason: "RESERVATION_TAKEN",
    };
  }

  if (!canReserveGift(statusRow)) {
    return { ok: false, code: "CONFLICT", message: "Cannot reserve" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timeZone: true },
  });
  const timeZone = canonicalTimeZone(storedTimeZone(user?.timeZone) ?? null);
  const locale = requestLocale(headers);

  if (!isDueOnInRange(parsed.data.dueOn, timeZone)) {
    const max = formatDate(maxReserveDueOn(timeZone), locale, { timeZone });
    return {
      ok: false,
      code: "VALIDATION",
      message: "Due date out of range",
      reason: "DUE_OUT_OF_RANGE",
      params: { max },
    };
  }

  const now = new Date();
  const reservationDueAt = reservationDueAtFromDueOn(parsed.data.dueOn, timeZone);

  const outcome = await prisma.$transaction(async function reserve(tx) {
    return giftStatusTransaction(tx).reserveGift(giftId, {
      reservedById: session.user.id,
      reservedAt: now,
      titleSnapshotOnReserve: row.title,
      reservationDueAt,
      reservationTimeZone: timeZone,
      reservationPhaseAt: now,
      holderVisibleToOwner: parsed.data.holderVisibleToOwner,
      holderVisibleToOthers: parsed.data.holderVisibleToOthers,
    });
  });

  if (outcome === "lost") {
    const after = await prisma.gift.findFirst({
      where: { id: giftId },
      select: { status: true },
    });
    if (!after) return notFound;
    if (after.status === "RESERVED") {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Reservation taken",
        reason: "RESERVATION_TAKEN",
      };
    }
    return { ok: false, code: "CONFLICT", message: "Cannot reserve" };
  }

  const fresh = await prisma.gift.findFirst({
    where: { id: giftId },
    select: reserveSelect,
  });
  if (!fresh) return notFound;

  const card = toViewerGiftCard(fresh, session.user.id, locale);
  return { ok: true, data: giftCardSchema.parse(card) };
}