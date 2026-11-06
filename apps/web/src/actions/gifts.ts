import "server-only";

import {
  giftCardSchema,
  giftInputSchema,
  giftUpdateSchema,
  negotiateLocale,
  preferredFromAcceptLanguage,
  type ActionResult,
  type GiftCard,
  type GiftTagInput,
  type SupportedLocale,
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
  // Story 2.5/AD-22: only what the card shows. `slug` is fetched for the card's
  // deterministic display order (2.5.7); it never reaches the client.
  tags: {
    select: { tagId: true, customText: true, tag: { select: { labels: true, slug: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.GiftSelect;

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

/** AD-27: fixed tag labels follow the request language, like the catalog read. */
function requestLocale(headers: Headers): SupportedLocale {
  return negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));
}

/**
 * A `GiftTag` row a writer may create. Fixed tags are aggregate-eligible right
 * away; custom text stays out until ADMIN approval (AD-22, Story 10.2). The
 * client cannot influence either flag — the input schema has no such field.
 */
type GiftTagCreate =
  | { tagId: string; aggregateEligible: true }
  | { customText: string; aggregateEligible: false };

function toTagRows(tags: readonly GiftTagInput[]): GiftTagCreate[] {
  return tags.map(function toTagRow(tag) {
    return "catalogId" in tag
      ? { tagId: tag.catalogId, aggregateEligible: true as const }
      : { customText: tag.text, aggregateEligible: false as const };
  });
}

/** Raised inside a transaction when a fixed tag id matches no catalog row. */
class MissingCatalogTagError extends Error {}

/** PostgreSQL constraint that ties a `GiftTag` row to the tag catalog. */
const TAG_ID_FOREIGN_KEY = "GiftTag_tagId_fkey";
/** Relation whose unique indexes and catalog FK are tag-write failures. */
const GIFT_TAG_RELATION = "GiftTag";

/** Real adapter metadata shape, narrowed to the names a mapper may read. */
type ConstraintMeta = {
  modelName?: unknown;
  field_name?: unknown;
  target?: unknown;
  table?: unknown;
  driverAdapterError?: {
    cause?: {
      table?: unknown;
      constraint?: { index?: unknown; fields?: unknown };
    };
  };
};

function pushNames(names: string[], value: unknown): void {
  if (typeof value === "string") {
    names.push(value);
    return;
  }
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (typeof item === "string") names.push(item);
  }
}

/**
 * Names Prisma records for a failed constraint; empty when it gave none.
 *
 * Prisma 7.10 with `@prisma/adapter-pg` puts the PostgreSQL constraint only in
 * `meta.driverAdapterError.cause.constraint.index` for a nested write and keeps
 * `modelName` at the operation root (`Gift`). Older/other runtimes use
 * `modelName`/`field_name`/`target`, so both shapes are read.
 */
function constraintNames(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = (error as { meta?: ConstraintMeta }).meta;
  if (!meta) return [];

  const cause = meta.driverAdapterError?.cause;
  const names: string[] = [];
  pushNames(names, meta.modelName);
  pushNames(names, meta.field_name);
  pushNames(names, meta.target);
  pushNames(names, meta.table);
  pushNames(names, cause?.constraint?.index);
  pushNames(names, cause?.constraint?.fields);
  pushNames(names, cause?.table);
  return names;
}

/**
 * A failure of the tag write itself. P2003: a catalog row was deleted between
 * the existence check and the insert (ADMIN deletion is Story 10.2), so the
 * id is no longer valid input. P2002: a concurrent replacement hit one of the
 * `GiftTag` unique indexes.
 *
 * P2003 is mapped only when the adapter names the catalog FK
 * (`GiftTag_tagId_fkey`); the root `modelName` of a nested create is `Gift`, so
 * matching it would also swallow the gift's own `Gift_listId_fkey`. P2002 is
 * mapped only for the `GiftTag` relation. A runtime without metadata keeps the
 * old behaviour: the caller asks only after sending tag rows. A foreign key to
 * another table stays an infrastructure failure and is rethrown.
 */
function tagWriteFailure(error: unknown): ActionResult<GiftCard> | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  const names = constraintNames(error);
  const hasNames = names.length > 0;

  if (error.code === "P2003") {
    const namesTagForeignKey = names.some(function includesTagFk(name) {
      return name.includes(TAG_ID_FOREIGN_KEY);
    });
    if (hasNames && !namesTagForeignKey) return null;
    return validation("tags");
  }

  if (error.code === "P2002") {
    const namesGiftTag = names.some(function includesGiftTag(name) {
      return name.includes(GIFT_TAG_RELATION);
    });
    if (hasNames && !namesGiftTag) return null;
    return {
      ok: false,
      code: "CONFLICT",
      message: "Tags conflict with a concurrent change",
      field: "tags",
    };
  }
  return null;
}

/**
 * Fixed tag ids must exist before anything is written. On update the check runs
 * inside the same transaction as the tag replacement, so a catalog change cannot
 * slip between the check and the insert and a missing id rolls everything back.
 * On create the check runs before the nested create; the create itself is one
 * atomic statement, and a catalog row deleted between check and insert surfaces
 * as a P2003 that `tagWriteFailure` maps to the same VALIDATION (ADMIN deletion
 * is Story 10.2).
 */
async function fixedTagsExist(
  db: Prisma.TransactionClient,
  tags: readonly GiftTagInput[],
): Promise<boolean> {
  const catalogIds = tags.flatMap(function catalogIdOf(tag) {
    return "catalogId" in tag ? [tag.catalogId] : [];
  });
  if (catalogIds.length === 0) return true;

  const found = await db.tag.findMany({
    where: { id: { in: catalogIds } },
    select: { id: true },
  });
  return found.length === catalogIds.length;
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

  return { ok: true, data: giftCardSchema.parse(toOwnerGiftCard(row, requestLocale(headers))) };
}

/**
 * Story 2.2 (FR-10, AD-1): the owner creates a wish in their single list (AD-6).
 * The body goes through `giftInputSchema`, so the defaults live in the contract:
 * visibility `PUBLIC` (ARCH-A17), currency `USD` when an amount has none (AD-25),
 * quantity `SINGLE` (Story 2.5/D-25), no tags. `status` starts `OPEN` (AD-8).
 * Shared by the app form and `POST /api/v1/...`.
 *
 * Story 2.5 (AD-22): fixed and custom tags are written with the gift in one
 * nested create, so a bad tag never leaves a gift behind. A fixed tag id must
 * exist in the catalog; its row becomes `aggregateEligible` here, never through
 * the body.
 */
export async function createGift(headers: Headers, body: unknown): Promise<ActionResult<GiftCard>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const parsed = giftInputSchema.safeParse(body);
  if (!parsed.success) return validation(firstIssueField(parsed.error));

  // AD-6 creates the list at registration, so a missing row is an anomaly; a
  // gift cannot exist without a list. The owner read repairs that anomaly to
  // return a share token, while this write still refuses explicitly instead of
  // creating a gift in an unexpected list.
  const list = await prisma.list.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!list) return { ok: false, code: "NOT_FOUND", message: "Wishlist not found" };

  const tags = parsed.data.tags;
  if (!(await fixedTagsExist(prisma, tags))) return validation("tags");

  const tagRows = toTagRows(tags);
  try {
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
        // An absent key keeps the create identical to a body without tags.
        ...(tagRows.length > 0 ? { tags: { create: tagRows } } : {}),
      },
      select: ownerGiftSelect,
    });

    return {
      ok: true,
      data: giftCardSchema.parse(toOwnerGiftCard(row, requestLocale(headers))),
    };
  } catch (error) {
    // The nested create is one statement, so a tag that lost the race leaves
    // no gift behind; only the tag write is mapped to the envelope.
    const tagFailure = tagRows.length > 0 ? tagWriteFailure(error) : null;
    if (tagFailure) return tagFailure;
    throw error;
  }
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
 *
 * Story 2.5 (AD-22): `tags` is a full replacement. An omitted key preserves the
 * stored tags; an explicit empty array clears them (the form removes a chip);
 * otherwise the old rows are replaced in one transaction with the field write.
 * Tags have no status restriction of their own: AD-8 allows editing the fields
 * of a `RESERVED` wish, and only `visibility` and `quantity` are `OPEN`-only.
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

  const { tags, ...fields } = parsed.data;

  // The owner is the list owner (AD-6); the caller cannot pick the list or gift.
  const ownedGift = {
    id: giftId,
    archivedAt: null,
    list: { ownerId: session.user.id },
  };

  const changesVisibility = fields.visibility !== undefined;
  const changesQuantity = fields.quantity !== undefined;
  const needsStoredPrice = fields.priceCurrency !== undefined && fields.priceAmount === undefined;

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
      fields.priceCurrency = stored.priceAmount === null ? null : fields.priceCurrency;
    }

    if (changesVisibility) {
      if (stored.visibility === fields.visibility) {
        // The form of a reserved wish resends the stored value: nothing to change.
        delete fields.visibility;
      } else if (stored.status !== "OPEN") {
        return validation("visibility");
      }
    }

    if (changesQuantity) {
      if (stored.quantity === fields.quantity) {
        // Same rule for a resent quantity: an unchanged value is not a change.
        delete fields.quantity;
      } else if (stored.status !== "OPEN") {
        return validation("quantity");
      }
    }
  }

  // Story 2.3/2.5/AD-8: a real visibility or quantity change writes only while
  // the gift is OPEN, so a reservation between the read above and this write
  // answers VALIDATION.
  const guarded = fields.visibility !== undefined || fields.quantity !== undefined;
  const where = guarded ? { ...ownedGift, status: "OPEN" as const } : ownedGift;

  try {
    if (tags === undefined) {
      // AD-8: editing any other field at RESERVED is allowed; tags follow the
      // same rule, so the tag path is not limited to OPEN wishes either.
      const row = await prisma.gift.update({
        where,
        data: fields,
        select: ownerGiftSelect,
      });
      return {
        ok: true,
        data: giftCardSchema.parse(toOwnerGiftCard(row, requestLocale(headers))),
      };
    }

    // Story 2.5: the tag set is replaced atomically with the field write. The
    // gift update goes first, so a foreign or archived gift fails before a
    // single tag row is touched; any later failure rolls everything back.
    const row = await prisma.$transaction(async function replaceTags(tx) {
      if (!(await fixedTagsExist(tx, tags))) throw new MissingCatalogTagError();

      const updated = await tx.gift.update({
        where,
        data: fields,
        select: { id: true },
      });

      await tx.giftTag.deleteMany({ where: { giftId: updated.id } });
      const tagRows = toTagRows(tags);
      if (tagRows.length > 0) {
        await tx.giftTag.createMany({
          data: tagRows.map(function withGiftId(tag) {
            return { ...tag, giftId: updated.id };
          }),
        });
      }

      return tx.gift.findFirst({ where: { id: updated.id }, select: ownerGiftSelect });
    });
    if (row === null) return notFound;

    return {
      ok: true,
      data: giftCardSchema.parse(toOwnerGiftCard(row, requestLocale(headers))),
    };
  } catch (error) {
    if (error instanceof MissingCatalogTagError) return validation("tags");

    if (tags !== undefined) {
      const tagFailure = tagWriteFailure(error);
      if (tagFailure) return tagFailure;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      // A guarded write can lose the race with a reservation: re-read to tell
      // "no longer OPEN" (VALIDATION) from "foreign or archived" (NOT_FOUND).
      if (guarded) {
        const current = await prisma.gift.findFirst({
          where: ownedGift,
          select: { status: true },
        });
        if (current && current.status !== "OPEN") {
          return validation(fields.visibility !== undefined ? "visibility" : "quantity");
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
