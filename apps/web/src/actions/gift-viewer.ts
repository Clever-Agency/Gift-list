import "server-only";

import {
  giftCardSchema,
  negotiateLocale,
  preferredFromAcceptLanguage,
  type ActionResult,
  type GiftCard,
  type SupportedLocale,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Prisma } from "@/db/generated/client";
import { toViewerGiftCard } from "@/domain/viewer-gift-card";
import { NO_RELATIONS, VisibilityPolicy } from "@/domain/visibility";
import { auth } from "@/lib/auth";
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
  message: "Forbidden",
};

const viewerGiftSelect = {
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
  reservedBy: { select: { id: true, nick: true, name: true } },
  tags: {
    select: { tagId: true, customText: true, tag: { select: { labels: true, slug: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  list: { select: { ownerId: true } },
} satisfies Prisma.GiftSelect;

function requestLocale(headers: Headers): SupportedLocale {
  return negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
}

/**
 * Story 5.1: a signed-in non-owner reads one visible wish for the detail screen
 * and the reserve flow. The owner uses `GET /api/v1/me/gifts/:id` instead.
 */
export async function getViewerGift(headers: Headers, giftId: string): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const row = await prisma.gift.findFirst({
    where: { id: giftId, archivedAt: null },
    select: viewerGiftSelect,
  });
  if (!row) return notFound;

  const ownerId = row.list.ownerId;
  if (ownerId === session.user.id) return forbidden;

  const relations = {
    ...(await relationshipReader.relationsBetween(session.user.id, ownerId)),
    viaListToken: false,
  };
  if (relations.blocked) return notFound;

  const visible = VisibilityPolicy.canSee({ id: session.user.id }, relations, {
    ownerId,
    visibility: row.visibility,
    archivedAt: row.archivedAt,
  });
  if (!visible) return notFound;

  const locale = requestLocale(headers);
  const card = toViewerGiftCard(row, session.user.id, locale);
  return { ok: true, data: giftCardSchema.parse(card) };
}