import "server-only";

import {
  giftCardSchema,
  giftInputSchema,
  type ActionResult,
  type GiftCard,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";
import { firstIssueField } from "@/lib/api-v1";
import { auth } from "@/lib/auth";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/** Columns the owner card reads; the same shape the list read selects (AD-12). */
const ownerGiftSelect = {
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
} as const;

function validation(field?: string): ActionResult<GiftCard> {
  return {
    ok: false,
    code: "VALIDATION",
    message: "Invalid input",
    ...(field ? { field } : {}),
  };
}

/**
 * Story 2.2 (FR-10, AD-1): the owner creates a wish in their single list (AD-6).
 * The body goes through `giftInputSchema`, so the defaults live in the contract:
 * visibility `PUBLIC` (ARCH-A17), currency `USD` when an amount has none (AD-25).
 * `status` starts `OPEN` (AD-8) and `quantity` stays at the schema default
 * `SINGLE` until Story 2.5. Shared by the app form and `POST /api/v1/...`.
 */
export async function createGift(headers: Headers, body: unknown): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const parsed = giftInputSchema.safeParse(body);
  if (!parsed.success) return validation(firstIssueField(parsed.error));

  // AD-6 creates the list at registration, so a missing row is an anomaly; a
  // gift cannot exist without a list, unlike the empty wishlist of the read.
  const list = await prisma.list.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!list) return { ok: false, code: "NOT_FOUND", message: "Wishlist not found" };

  const row = await prisma.gift.create({
    data: {
      listId: list.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priceAmount: parsed.data.priceAmount,
      priceCurrency: parsed.data.priceCurrency,
      linkUrl: parsed.data.linkUrl,
      visibility: parsed.data.visibility,
      status: "OPEN",
    },
    select: ownerGiftSelect,
  });

  return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row)) };
}
