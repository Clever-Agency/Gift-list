import "server-only";

import { listDataSchema, type ActionResult, type ListData } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";
import { NO_RELATIONS, VisibilityPolicy } from "@/domain/visibility";
import { auth } from "@/lib/auth";

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
  const list = await prisma.list.findUnique({
    where: { ownerId },
    select: { id: true, ownerId: true },
  });
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

  const gifts = rows
    // AD-7: the owner branch is decided by the list owner, not by whoever the
    // session claims to be.
    .filter((row) =>
      VisibilityPolicy.canSee({ id: ownerId }, NO_RELATIONS, {
        ownerId: list.ownerId,
        visibility: row.visibility,
        archivedAt: row.archivedAt,
      }),
    )
    .map(toOwnerGiftCard);

  return { ok: true, data: listDataSchema.parse({ access: "gifts", gifts }) };
}
