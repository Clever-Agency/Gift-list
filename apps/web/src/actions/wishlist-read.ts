import "server-only";

import {
  DEFAULT_LOCALE,
  listDataSchema,
  type ListData,
  type SupportedLocale,
} from "@gift-list/contracts";
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
export type WishlistTarget =
  | { readonly ownerId: string }
  | { readonly publicToken: string; readonly giftId?: string };

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

/** The owner's archive is read newest-first and capped; the full count rides separately. */
const ARCHIVE_PAGE = 100;

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
  reservationDueAt: true,
  reservationTimeZone: true,
  reservationBought: true,
  holderVisibleToOwner: true,
  holderVisibleToOthers: true,
  // Story 5.3: one select for the owner and the viewer; only the owner mapper
  // turns it into `undoUntil`.
  closedAt: true,
  reservedBy: { select: { id: true, nick: true, name: true } },
  // Story 2.5/AD-22: only what the card shows. `slug` orders fixed tags like the
  // catalog (2.5.7) and never reaches the client.
  tags: {
    select: {
      tagId: true,
      customText: true,
      tag: { select: { labels: true, slug: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.GiftSelect;

async function resolveWishlistAccess(
  { viewer, target, viaListToken }: Omit<ReadWishlistInput, "locale">,
  reader: RelationshipReader,
) {

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
  // A missing list is the closed gate before any gift is read, so neither a
  // wrong nick nor a wrong token reveals that a list exists (AD-7).
  if (list === null) return null;

  const viewerId = viewer?.id ?? null;
  const owner = viewerId !== null && viewerId === list.ownerId;
  // The owner branch needs no relation facts; everybody else asks the port and
  // adds the one fact only the caller knows — the list token it arrived with.
  const relations: ViewerRelations = owner
    ? NO_RELATIONS
    : {
        ...(await reader.relationsBetween(viewerId, list.ownerId)),
        // Story 3.3: the token fact only exists when the read actually came
        // through the link, so a nick or `/me` read can never open `PUBLIC` by
        // accident just because a caller passed the flag.
        viaListToken: viaListToken === true && "publicToken" in target,
      };

  if (VisibilityPolicy.resolve(viewer, relations, list, []).access === "not_found") return null;
  return { list, relations, owner };
}

/** Check the list before handing off to the app, which loads the wish cards. */
export async function canOpenPublicWishlist(
  token: string,
  viewer: NonNullable<VisibilityViewer>,
): Promise<boolean> {
  const access = await resolveWishlistAccess(
    { viewer, target: { publicToken: token }, viaListToken: true },
    relationshipReader,
  );
  return access !== null;
}

/**
 * The single wishlist read of the server (AD-7, AD-12, NFR-3). The SQL `where`
 * narrows gift rows before `VisibilityPolicy.resolve` selects the visible cards.
 * The caller maps a missing or blocked list (`null`) to the same HTTP 404.
 */
export async function readWishlist(
  input: ReadWishlistInput,
  deps: ReadWishlistDeps = { reader: relationshipReader },
): Promise<ListData | null> {
  const access = await resolveWishlistAccess(input, deps.reader);
  if (access === null) return null;
  const { list, relations, owner } = access;
  const { viewer, target } = input;
  const giftId = "publicToken" in target ? target.giftId : undefined;
  const viewerId = viewer?.id ?? null;
  // Only the link response names the owner; `/me` already knows the name.
  const ownerFields =
    "publicToken" in target
      ? { owner: { displayName: list.owner.name, nick: list.owner.nick } }
      : {};

  const allowed = VisibilityPolicy.allowedVisibilities(viewer, relations, list.ownerId);
  // Nothing is visible to this viewer: answer an empty list without a gift query.
  if (allowed.length === 0) {
    return listDataSchema.parse({ access: "gifts", gifts: [], ...ownerFields });
  }

  const rows = await prisma.gift.findMany({
    // The owner is allowed every visibility value, so an `in` filter would only
    // repeat the whole column domain; everybody else narrows the read in SQL so
    // hidden rows never leave the database (NFR-3). Archived gifts stay out of
    // the active list (AD-8); the owner gets them in `archived` below.
    where: {
      listId: list.id,
      archivedAt: null,
      ...(giftId === undefined ? {} : { id: giftId }),
      ...(owner ? {} : { visibility: { in: allowed } }),
    },
    // Newest wish first; `id` keeps the order stable for equal timestamps.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: giftSelect,
  });

  // `Gift` has no owner column — every gift of a list belongs to its owner.
  const gated = rows.map((row) => ({ ...row, ownerId: list.ownerId }));
  // Always resolve, even though the `where` already narrowed the rows: the policy
  // is the second gate AD-7 promises, and its role picks the card mapper.
  const resolved = VisibilityPolicy.resolve(viewer, relations, list, gated);
  if (resolved.access === "not_found") return null;

  const role = resolved.role;
  const locale = input.locale ?? DEFAULT_LOCALE;
  const gifts = resolved.gifts.map(function toListGiftCard(gift) {
    return role === "owner"
      ? toOwnerGiftCard(gift, locale)
      : toViewerGiftCard(gift, viewerId, locale);
  });

  if (giftId !== undefined) {
    return listDataSchema.parse({ access: "gifts", gifts, ...ownerFields });
  }

  // Story 2.6: only the owner sees the archive. Viewers never get the key, so a
  // shared schema stays closed and an archived title cannot leak.
  const archivedWhere = { listId: list.id, NOT: { archivedAt: null } };
  const [archivedRows, archivedTotal] = owner
    ? await prisma.$transaction([
        prisma.gift.findMany({
          where: archivedWhere,
          orderBy: [{ archivedAt: "desc" }, { id: "desc" }],
          take: ARCHIVE_PAGE,
          select: giftSelect,
        }),
        prisma.gift.count({ where: archivedWhere }),
      ])
    : [undefined, undefined];
  const archived = archivedRows?.map(function toArchivedCard(row) {
    return toOwnerGiftCard(row, locale);
  });

  return listDataSchema.parse({
    access: "gifts",
    gifts,
    ...ownerFields,
    // Story 2.4 (AD-6, A-26): only the owner gets the immutable share token; the
    // link `/l/{publicToken}` is what the owner shares, nobody else.
    ...(owner ? { publicToken: list.publicToken, archived, archivedTotal } : {}),
  });
}
