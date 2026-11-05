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
import { NO_RELATIONS, VisibilityPolicy } from "@/domain/visibility";
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

/** The owner select plus the list owner, which `canSee` needs (AD-7). */
const formGiftSelect = {
  ...ownerGiftSelect,
  list: { select: { ownerId: true } },
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
 *
 * AD-7: the form is the owner branch, and this read calls `canSee` like every
 * other gift read. Ownership already narrows the `where`; the gate decides again
 * so the policy stays the single place that answers visibility. Reading another
 * person's wishes is `readWishlist`'s job, not this use-case's.
 */
export async function getGift(headers: Headers, giftId: string): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const row = await prisma.gift.findFirst({
    where: { id: giftId, archivedAt: null, list: { ownerId: session.user.id } },
    select: formGiftSelect,
  });
  if (!row) return notFound;

  const visible = VisibilityPolicy.canSee({ id: session.user.id }, NO_RELATIONS, {
    ownerId: row.list.ownerId,
    visibility: row.visibility,
    archivedAt: row.archivedAt,
  });
  if (!visible) return notFound;

  return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row)) };
}

/**
 * Story 2.2 (FR-10, AD-1): the owner creates a wish in their single list (AD-6).
 * The body goes through `giftInputSchema`, so the defaults live in the contract:
 * visibility `PUBLIC` (ARCH-A17), currency `USD` when an amount has none (AD-25),
 * quantity `SINGLE` (Story 2.5/D-25). `status` starts `OPEN` (AD-8). Shared by
 * the app form and `POST /api/v1/...`.
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
      quantity: parsed.data.quantity,
      status: "OPEN",
    },
    select: ownerGiftSelect,
  });

  return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row)) };
}

/**
 * Story 2.2 (FR-10, AD-1): the owner edits a wish of their own list. The body is
 * a partial (`giftUpdateSchema`), so only the keys that came in reach the row: an
 * absent field keeps the stored value, `status` and list are not editable here
 * (AD-8). The ownership check rides in the write's
 * `where`, so a gift of another list — or an archived one (AD-8) — matches
 * nothing and answers NOT_FOUND without revealing that the id exists.
 *
 * Story 2.3 (FR-10, AD-8): visibility moves only while the wish is `OPEN`. A
 * reserved or closed wish answers VALIDATION and writes nothing, but sending the
 * stored value back — the edit form of a reserved wish does that — is not a
 * change and passes through. The write itself repeats `status: "OPEN"` in the
 * `where`, so a reservation between this read and the write cannot slip through.
 *
 * Story 2.5 (FR-41, D-25): `quantity` follows the same rule — a changed value is
 * written only while the wish is `OPEN`, and an unchanged one is not a change.
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

  const changesVisibility = update.visibility !== undefined;
  const changesQuantity = update.quantity !== undefined;
  const needsStoredPrice = update.priceCurrency !== undefined && update.priceAmount === undefined;

  // One read serves both gates: AD-25 needs the stored amount, Story 2.3 needs
  // the stored status and visibility, Story 2.5 needs the stored quantity. The
  // update below still carries the ownership gate, so this read is only for the
  // mix-in and the editability rules.
  if (changesVisibility || changesQuantity || needsStoredPrice) {
    const stored = await prisma.gift.findFirst({
      where: ownedGift,
      select: { priceAmount: true, status: true, visibility: true, quantity: true },
    });
    if (!stored) return notFound;

    // AD-25: a currency sent without an amount keeps the stored amount; a stored
    // `null` amount leaves nothing to price, so the currency is dropped again — a
    // price never exists as a currency alone.
    if (needsStoredPrice) {
      update.priceCurrency = stored.priceAmount === null ? null : update.priceCurrency;
    }

    if (changesVisibility) {
      if (stored.visibility === update.visibility) {
        // The form of a reserved wish resends the stored value: nothing to change.
        delete update.visibility;
      } else if (stored.status !== "OPEN") {
        return validation("visibility");
      }
    }

    if (changesQuantity) {
      if (stored.quantity === update.quantity) {
        // Same rule for a resent quantity: an unchanged value is not a change.
        delete update.quantity;
      } else if (stored.status !== "OPEN") {
        return validation("quantity");
      }
    }
  }

  // Story 2.3/2.5/AD-8: a real visibility or quantity change writes only while
  // the gift is OPEN, so a reservation between the read above and this write
  // answers VALIDATION.
  const guarded = update.visibility !== undefined || update.quantity !== undefined;
  const where = guarded ? { ...ownedGift, status: "OPEN" as const } : ownedGift;

  try {
    const row = await prisma.gift.update({
      where,
      data: update,
      select: ownerGiftSelect,
    });
    return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row)) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      // A guarded write can lose the race with a reservation: re-read to tell
      // "no longer OPEN" (VALIDATION) from "foreign or archived" (NOT_FOUND).
      if (guarded) {
        const current = await prisma.gift.findFirst({
          where: ownedGift,
          select: { status: true },
        });
        if (current && current.status !== "OPEN") {
          return validation(update.visibility !== undefined ? "visibility" : "quantity");
        }
      }
      // P2025: the where matched nothing, i.e. a foreign or archived gift.
      return notFound;
    }
    throw error;
  }
}

/**
 * Story 2.3 (FR-10): the owner deletes an `OPEN` wish of their own list. The
 * delete's `where` carries ownership, "not archived" and the status (AD-6, AD-8),
 * so a foreign or archived id removes nothing. A wish that still exists after
 * the delete is reserved or closed: this use-case only deletes `OPEN` ones —
 * `RESERVED` is Story 5.4 and `CLOSED` is removed from "Received" (Story 2.6).
 * Everything that matches nothing answers the same NOT_FOUND, so a foreign id
 * never reveals that it exists (AD-7).
 */
export async function deleteGift(
  headers: Headers,
  giftId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const { count } = await prisma.gift.deleteMany({
    where: {
      id: giftId,
      archivedAt: null,
      status: "OPEN",
      list: { ownerId: session.user.id },
    },
  });
  if (count === 1) return { ok: true, data: { id: giftId } };

  // Still there and owned: reserved or closed, which this use-case does not delete.
  const existing = await prisma.gift.findFirst({
    where: { id: giftId, archivedAt: null, list: { ownerId: session.user.id } },
    select: { status: true },
  });
  if (existing) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "Only an open wish can be deleted here",
    };
  }

  // Foreign, archived or missing: one answer for all three (AD-7).
  return notFound;
}
