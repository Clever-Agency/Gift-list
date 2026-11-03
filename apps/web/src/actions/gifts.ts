import "server-only";

import {
  giftCardSchema,
  giftInputSchema,
  giftUpdateSchema,
  type ActionResult,
  type GiftCard,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";
import { firstIssueField } from "@/lib/api-v1";
import { auth } from "@/lib/auth";

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
 * Story 2.2 (FR-10, AD-1, AD-12): the edit screen loads one wish of the owner's
 * single list. Ownership and "not archived" ride in the read's `where` (AD-6,
 * AD-8), so a foreign or archived id matches nothing and answers NOT_FOUND
 * without revealing that the gift exists.
 */
export async function getGift(headers: Headers, giftId: string): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const row = await prisma.gift.findFirst({
    where: { id: giftId, archivedAt: null, list: { ownerId: session.user.id } },
    select: ownerGiftSelect,
  });
  if (!row) return notFound;

  return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row)) };
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

/**
 * Story 2.2 (FR-10, AD-1): the owner edits a wish of their own list. The body is
 * a partial (`giftUpdateSchema`), so only the keys that came in reach the row: an
 * absent field keeps the stored value, `status`, list and `quantity` are not
 * editable here (AD-8, Story 2.5). The ownership check rides in the write's
 * `where`, so a gift of another list — or an archived one (AD-8) — matches
 * nothing and answers NOT_FOUND without revealing that the id exists.
 */
export async function updateGift(
  headers: Headers,
  giftId: string,
  body: unknown,
): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const parsed = giftUpdateSchema.safeParse(body);
  if (!parsed.success) return validation(firstIssueField(parsed.error));

  const update = parsed.data;

  // The owner is the list owner (AD-6); the caller cannot pick the list or gift.
  const ownedGift = {
    id: giftId,
    archivedAt: null,
    list: { ownerId: session.user.id },
  };

  // AD-25: a currency sent without an amount keeps the stored amount, so read it
  // first. A stored `null` amount leaves nothing to price, and the currency is
  // dropped again — a price never exists as a currency alone. The update below
  // still carries the ownership gate, so this read is only for the mix-in.
  if (update.priceCurrency !== undefined && update.priceAmount === undefined) {
    const stored = await prisma.gift.findFirst({
      where: ownedGift,
      select: { priceAmount: true },
    });
    if (!stored) return notFound;
    update.priceCurrency = stored.priceAmount === null ? null : update.priceCurrency;
  }

  try {
    const row = await prisma.gift.update({
      where: ownedGift,
      data: update,
      select: ownerGiftSelect,
    });
    return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row)) };
  } catch (error) {
    // P2025: the where matched nothing, i.e. a foreign or archived gift.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return notFound;
    }
    throw error;
  }
}
