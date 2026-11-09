import "server-only";

import { DEFAULT_LOCALE, listDataSchema, type ListData, type SupportedLocale } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { Prisma } from "@/db/generated/client";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";
import {
  NO_RELATIONS,
  VisibilityPolicy,
  type RelationshipReader,
  type ViewerRelations,
  type VisibilityViewer,
} from "@/domain/visibility";
import { toViewerGiftCard } from "@/domain/viewer-gift-card";
import { relationshipReader } from "@/lib/relationships";

/** Whose list to read: an owner (`/me`, `/u/:nick`) or the public link token. */
export type WishlistTarget = { readonly ownerId: string } | { readonly publicToken: string };

/** One list read: who is asking, whose list, and whether a link brought them (Story 3.3). */
export type ReadWishlistInput = {
  readonly viewer: VisibilityViewer;
  readonly target: WishlistTarget;
  readonly viaListToken?: boolean;
  /**
   * AD-27: the request language for fixed tag labels. The caller negotiates it
   * from `Accept-Language`; the mapper falls back to `DEFAULT_LOCALE`.
   */
  readonly locale?: SupportedLocale;
};

/** Ports the read depends on; tests hand over a scripted reader. */
export type ReadWishlistDeps = { readonly reader: RelationshipReader };

/** Closed `not_found` answer; it never explains itself (AD-7 / AD-12). */
const notFound: ListData = { access: "not_found", gifts: [] };

/** Fields both card mappers need; `ownerId` is not a `Gift` column, see below. */
const giftSelect = {
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
  reservationBought: true,
  holderVisibleToOwner: true,
  holderVisibleToOthers: true,
  reservedBy: { select: { id: true, nick: true, name: true } },
  // Story 2.5/AD-22: only what the card shows. `slug` orders fixed tags like the
  // catalog (2.5.7) and never reaches the client.
  tags: {
    select: { tagId: true, customText: true, tag: { select: { labels: true, slug: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.GiftSelect;

/**
 * The single wishlist read of the server (AD-7, AD-12, NFR-3). Every screen and
 * `api/v1` adapter goes through it, so the gate is never bypassed and hidden
 * gifts are not even read: the SQL `where` narrows the rows, then
 * `VisibilityPolicy.resolve` decides again and picks the owner or viewer card.
 * The answer is a closed `{ access, gifts }` — no counts, no hidden titles.
 */
export async function readWishlist(
  input: ReadWishlistInput,
  deps: ReadWishlistDeps = { reader: relationshipReader },
): Promise<ListData> {
  const { viewer, target } = input;

  const list = await prisma.list.findUnique({
    where: "ownerId" in target ? { ownerId: target.ownerId } : { publicToken: target.publicToken },
    // `publicToken` is only handed out below, in the owner's own answer (AD-6).
    // Story 3.3: a link read also names the owner for the page heading, so the
    // row carries the two public fields of `User` and nothing else.
    select: {
      id: true,
      ownerId: true,
      publicToken: true,
      owner: { select: { name: true, nick: true } },
    },
  });
  // A missing list answers `not_found` before any gift is read, so neither a
  // wrong nick nor a wrong token reveals that a list exists (AD-7).
  if (list === null) return listDataSchema.parse(notFound);

  // Story 3.3: only a read by the link token names the owner; the owner's own
  // `/me` read already knows it and keeps its answer unchanged.
  const ownerFields =
    "publicToken" in target
      ? { owner: { displayName: list.owner.name, nick: list.owner.nick } }
      : {};

  const viewerId = viewer?.id ?? null;
  const owner = viewerId !== null && viewerId === list.ownerId;
  // The owner branch needs no relation facts; everybody else asks the port and
  // adds the one fact only the caller knows — the list token it arrived with.
  const relations: ViewerRelations = owner
    ? NO_RELATIONS
    : {
        ...(await deps.reader.relationsBetween(viewerId, list.ownerId)),
        // Story 3.3: the token fact only exists when the read actually came
        // through the link, so a nick or `/me` read can never open `PUBLIC` by
        // accident just because a caller passed the flag.
        viaListToken: input.viaListToken === true && "publicToken" in target,
      };

  // A block hides the whole list, and it must look exactly like a missing list.
  if (!owner && relations.blocked) return listDataSchema.parse(notFound);

  const allowed = VisibilityPolicy.allowedVisibilities(viewer, relations, list.ownerId);
  // Nothing is visible to this viewer: answer an empty list without a gift query.
  if (allowed.length === 0) {
    return listDataSchema.parse({ access: "gifts", gifts: [], ...ownerFields });
  }

  const rows = await prisma.gift.findMany({
    // The owner is allowed every visibility value, so an `in` filter would only
    // repeat the whole column domain; everybody else narrows the read in SQL so
    // hidden rows never leave the database (NFR-3). Archived gifts stay out of
    // the active list until the archive section lands (AD-8, Story 2.6).
    where: owner
      ? { listId: list.id, archivedAt: null }
      : { listId: list.id, archivedAt: null, visibility: { in: allowed } },
    // Newest wish first; `id` keeps the order stable for equal timestamps.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: giftSelect,
  });

  // `Gift` has no owner column — every gift of a list belongs to its owner.
  const gated = rows.map((row) => ({ ...row, ownerId: list.ownerId }));
  // Always resolve, even though the `where` already narrowed the rows: the policy
  // is the second gate AD-7 promises, and its role picks the card mapper.
  const resolved = VisibilityPolicy.resolve(viewer, relations, list, gated);
  if (resolved.access === "not_found") return listDataSchema.parse(notFound);

  const role = resolved.role;
  const locale = input.locale ?? DEFAULT_LOCALE;
  const gifts = resolved.gifts.map(function toListGiftCard(gift) {
    return role === "owner"
      ? toOwnerGiftCard(gift, locale)
      : toViewerGiftCard(gift, viewerId, locale);
  });

  return listDataSchema.parse({
    access: "gifts",
    gifts,
    ...ownerFields,
    // Story 2.4 (AD-6, A-26): only the owner gets the immutable share token; the
    // link `/l/{publicToken}` is what the owner shares, nobody else.
    ...(owner ? { publicToken: list.publicToken } : {}),
  });
}
