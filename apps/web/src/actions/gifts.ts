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
  type GiftVisibilityPreview,
  type GiftVisibilityValue,
  type SupportedLocale,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { hasActiveReservation, visibilityChangeDropsReservation } from "@/domain/gift-status";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";
import { NO_RELATIONS, VisibilityPolicy } from "@/domain/visibility";
import { firstIssueField } from "@/lib/api-v1";
import { auth } from "@/lib/auth";
import { giftStatusTransaction } from "@/lib/gift-status-store";
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

/**
 * AD-8 (ред. 2026-11-11, CLE-82): the owner's archived wish is read-only, and
 * the reason lets the client show «Архивное желание можно только просматривать».
 * A foreign archived wish still answers NOT_FOUND, so this never confirms that
 * somebody else's wish exists (AD-7).
 */
const archivedValidation = {
  ok: false as const,
  code: "VALIDATION" as const,
  message: "Invalid input",
  reason: "GIFT_ARCHIVED" as const,
};

/**
 * AD-8 (ред. 2026-11-11): a `CLOSED` wish is read-only for every edit. The
 * reason is machine-readable; the exact closed-wish hint is client work (S23.3).
 */
const closedValidation = {
  ok: false as const,
  code: "VALIDATION" as const,
  message: "Invalid input",
  reason: "GIFT_CLOSED" as const,
};

/**
 * CLE-82/S23.2b: a snapshot CAS that loses to a concurrent reservation gets a
 * few fresh reads instead of overwriting the reservation. Three attempts cover
 * a reservation plus a release; a row that keeps moving under an owner's edit
 * is a conflict the client retries, not a NOT_FOUND (the wish exists).
 */
const MAX_UPDATE_ATTEMPTS = 3;

/**
 * CLE-82/S23.2b: the wish stayed editable but its `status`/holder kept changing
 * between the read and the write, so no attempt could apply the edit to the
 * snapshot it was decided on. The client reloads and repeats; the wish exists,
 * so this is never NOT_FOUND.
 */
const visibilityRaceConflict = {
  ok: false as const,
  code: "CONFLICT" as const,
  message: "The wish changed while saving",
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

/**
 * Stored values the edit rules read: AD-25 (price pair), Story 2.5 (`quantity`),
 * AD-8 (status and archive) and CLE-82 (`visibility`, holder).
 */
const storedGiftSelect = {
  priceAmount: true,
  priceCurrency: true,
  status: true,
  visibility: true,
  quantity: true,
  archivedAt: true,
  reservedById: true,
} satisfies Prisma.GiftSelect;

/** What the visibility preflight reads; nothing else is needed to answer it. */
const previewGiftSelect = {
  status: true,
  visibility: true,
  archivedAt: true,
  reservedById: true,
} satisfies Prisma.GiftSelect;

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
 * (AD-8). Ownership is checked before any rule below: a wish of another list, or
 * a missing id, answers NOT_FOUND without revealing that the id exists (AD-7).
 *
 * AD-8 (ред. 2026-11-11, CLE-82): the owner's own archived wish and every
 * `CLOSED` wish are read-only. Both answer VALIDATION with a machine-readable
 * `reason` (`GIFT_ARCHIVED` / `GIFT_CLOSED`) so the client can show the archived
 * hint; a foreign archived wish still answers NOT_FOUND.
 *
 * AD-25/D2/Н1: the amount and the currency are one price. `priceAmount: null`
 * clears both; an explicit `priceCurrency: null` over a stored amount is
 * VALIDATION (a price never exists without a currency); an amount sent alone
 * keeps the stored currency and takes `USD` only when the wish had no price; a
 * currency sent alone keeps the stored amount, or is dropped with a stored
 * `null` amount. This is the canonical rule: no amount without a currency, no
 * currency without an amount.
 *
 * FR-10 ред. 2026-11-11 (CLE-82, AD-7, AD-8): visibility changes while the wish
 * is `OPEN` **or** `RESERVED`; sending the stored value back is not a change. If
 * a narrowing takes the holder's AD-7 access away, the reservation is released
 * through `GiftStatusService` (`RESERVED → OPEN`, columns cleared) in the same
 * transaction as the visibility write; widening it later does not bring the
 * reservation back. The release is silent: notification infrastructure does not
 * exist yet (`deferred-work.md`). The AD-7 evaluation deliberately does not use
 * the A-14 reservation-card exception, and it counts the list link as available.
 *
 * CLE-82/S23.2b: the write is a CAS on the snapshot the decision was taken from
 * (`status` and `reservedById`), not the wider «not CLOSED» reader. A
 * reservation committed between the read and the `UPDATE` therefore fails the
 * CAS instead of being silently overwritten; the transaction is repeated
 * (`MAX_UPDATE_ATTEMPTS`) and the rule is re-evaluated against the holder the
 * row actually has — released if the new visibility hides the wish from them,
 * kept otherwise. `quantity` keeps its own answer: a change that meets a
 * reservation is VALIDATION on `quantity`, never a retry.
 *
 * Story 2.5 (FR-41, D-25): `quantity` stays `OPEN`-only — a changed value on a
 * `RESERVED` or `CLOSED` wish is VALIDATION, and a PATCH that carries both a
 * changed `quantity` and a visibility change on a reserved wish is rejected on
 * `quantity` without writing anything.
 *
 * Story 2.5 (AD-22): `tags` is a full replacement. An omitted key preserves the
 * stored tags; an explicit empty array clears them (the form removes a chip);
 * otherwise the old rows are replaced in the same transaction as the field write.
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

  const { tags, ...input } = parsed.data;
  const ownerId = session.user.id;

  // AD-25/D2/Н1: a price is a pair. A currency alone needs the stored amount
  // (to keep it or to drop the currency when there is none); an amount alone
  // needs the stored currency (to keep it, or `USD` when the wish had no price).
  const setsAmountAlone =
    input.priceAmount !== undefined &&
    input.priceAmount !== null &&
    input.priceCurrency === undefined;
  const setsCurrencyAlone = input.priceCurrency !== undefined && input.priceAmount === undefined;

  /**
   * Set inside the transaction when a changed `quantity` requires the wish to
   * stay `OPEN`. The race answer below reads it to name `quantity` instead of
   * retrying, which would only reject the same change on the fresh read.
   */
  let quantityRequiresOpen = false;

  for (let attempt = 1; ; attempt += 1) {
    quantityRequiresOpen = false;

    try {
      return await prisma.$transaction(async function updateOwnGift(tx) {
        // AD-7: ownership first, so a foreign id matches nothing and the archive
        // branch below never confirms that somebody else's wish exists.
        const stored = await tx.gift.findFirst({
          where: { id: giftId, list: { ownerId } },
          select: storedGiftSelect,
        });
        if (!stored) return notFound;

        // AD-8 (ред. 2026-11-11): the owner sees a reason, not a masked NOT_FOUND.
        if (stored.archivedAt !== null) return archivedValidation;
        if (stored.status === "CLOSED") return closedValidation;

        const fields = { ...input };

        if (setsCurrencyAlone) {
          // AD-25/D2: an explicit `null` currency would leave a stored amount
          // without a currency, and no card can show such a price — VALIDATION,
          // not a silent `USD` nor a silent wipe of the amount. With no stored
          // amount there is nothing to price, so the currency stays `null` and a
          // lone currency is never stored.
          if (fields.priceCurrency === null && stored.priceAmount !== null) {
            return validation("priceCurrency");
          }
          fields.priceCurrency = stored.priceAmount === null ? null : fields.priceCurrency;
        } else if (setsAmountAlone) {
          // AD-25/Н1: an absent currency keeps the stored one (a RUB wish stays
          // RUB). Only a wish that had no price yet falls back to `USD`; a legacy
          // row with an amount but no currency is repaired the same way.
          fields.priceCurrency = stored.priceCurrency ?? "USD";
        }

        // Story 2.5/AD-8: `quantity` is checked before the visibility rule, so a
        // combined PATCH on a reserved wish names `quantity` and writes nothing.
        if (fields.quantity !== undefined) {
          if (stored.quantity === fields.quantity) {
            // The form of a reserved wish resends the stored value: not a change.
            delete fields.quantity;
          } else if (stored.status !== "OPEN") {
            return validation("quantity");
          } else {
            quantityRequiresOpen = true;
          }
        }

        // FR-10 ред. 2026-11-11: visibility is writable at OPEN and RESERVED. A
        // narrowing that drops the holder's AD-7 access releases the reservation
        // in this same transaction; the preflight of S23.3 repeats this rule.
        let dropsReservation = false;
        if (fields.visibility !== undefined) {
          if (stored.visibility === fields.visibility) {
            delete fields.visibility;
          } else if (hasActiveReservation(stored) && stored.reservedById !== null) {
            dropsReservation = visibilityChangeDropsReservation({
              status: stored.status,
              ownerId,
              holderId: stored.reservedById,
              previousVisibility: stored.visibility,
              nextVisibility: fields.visibility,
              relations: await relationshipReader.relationsBetween(stored.reservedById, ownerId),
            });
          }
        }

        // Fail fast on an unknown catalog tag: nothing is written for a bad body.
        if (tags !== undefined && !(await fixedTagsExist(tx, tags))) {
          throw new MissingCatalogTagError();
        }

        // AD-8/AD-9 + CLE-82/S23.2b: the write lands only on the snapshot the
        // decision above was taken from. `status` and the holder are part of the
        // `where`, so a reservation (or a release) committed between the read and
        // this `UPDATE` fails the CAS instead of being overwritten with a
        // visibility the holder may no longer see. An archive or close still
        // keeps its own answer; `quantityRequiresOpen` reads the same failed CAS
        // as a reservation and names `quantity`. A changed quantity also requires
        // the wish to stay `OPEN`, which the snapshot carries.
        const updated = await tx.gift.update({
          where: {
            id: giftId,
            archivedAt: null,
            status: stored.status,
            reservedById: stored.reservedById,
          },
          data: fields,
          select: { id: true },
        });

        // AD-8: status and the reservation columns are written only by the service.
        if (dropsReservation) await giftStatusTransaction(tx).releaseReservation(updated.id);

        // Story 2.5: the tag set is replaced atomically with the field write.
        if (tags !== undefined) {
          await tx.giftTag.deleteMany({ where: { giftId: updated.id } });
          const tagRows = toTagRows(tags);
          if (tagRows.length > 0) {
            await tx.giftTag.createMany({
              data: tagRows.map(function withGiftId(tag) {
                return { ...tag, giftId: updated.id };
              }),
            });
          }
        }

        // Re-read after the release: the card must carry the status the row has now.
        const row = await tx.gift.findFirst({
          where: { id: updated.id },
          select: ownerGiftSelect,
        });
        if (row === null) return notFound;

        return {
          ok: true as const,
          data: giftCardSchema.parse(toOwnerGiftCard(row, requestLocale(headers))),
        };
      });
    } catch (error) {
      if (error instanceof MissingCatalogTagError) return validation("tags");

      if (tags !== undefined) {
        const tagFailure = tagWriteFailure(error);
        if (tagFailure) return tagFailure;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        // A CAS guard lost the race. Re-read to tell a wish that is now
        // read-only from one that merely needs a fresh snapshot: an archive or
        // close is VALIDATION, a quantity change that met a reservation is
        // VALIDATION on `quantity`, and a deleted or foreign id is NOT_FOUND.
        const current = await prisma.gift.findFirst({
          where: { id: giftId, list: { ownerId } },
          select: { status: true, archivedAt: true },
        });
        if (current === null) return notFound;
        if (current.archivedAt !== null) return archivedValidation;
        if (current.status === "CLOSED") return closedValidation;
        if (quantityRequiresOpen) return validation("quantity");

        // The wish is still editable, only its status or holder is not the one
        // this attempt decided on: it was reserved (or released) in between.
        // Re-run the transaction so the visibility rule meets the reservation
        // that actually exists (CLE-82/S23.2b). A reservation is not a reason to
        // answer NOT_FOUND — the wish is there.
        if (attempt < MAX_UPDATE_ATTEMPTS) continue;
        return visibilityRaceConflict;
      }
      throw error;
    }
  }
}

/**
 * CLE-82/S23.2 (FR-10 ред. 2026-11-11, AD-7): preflight of a visibility change on
 * the owner's wish. It answers whether the change would release the reservation,
 * so the client can show the confirm «Бронирующий потеряет доступ, бронь
 * снимется». It writes nothing and runs the same `VisibilityPolicy` rule as
 * `updateGift`; the write repeats the check inside its transaction, so this
 * answer may be stale without becoming unsafe.
 *
 * Ownership masks a foreign or missing wish as NOT_FOUND; the owner's own
 * archived or closed wish answers VALIDATION with its reason, like the write.
 */
export async function previewGiftVisibility(
  headers: Headers,
  giftId: string,
  visibility: GiftVisibilityValue,
): Promise<ActionResult<GiftVisibilityPreview>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = session.user.id;
  const stored = await prisma.gift.findFirst({
    where: { id: giftId, list: { ownerId } },
    select: previewGiftSelect,
  });
  if (!stored) return notFound;
  if (stored.archivedAt !== null) return archivedValidation;
  if (stored.status === "CLOSED") return closedValidation;

  const holderId = stored.reservedById;
  if (
    !hasActiveReservation(stored) ||
    holderId === null ||
    stored.visibility === visibility
  ) {
    return { ok: true, data: { wouldCancelReservation: false } };
  }

  return {
    ok: true,
    data: {
      wouldCancelReservation: visibilityChangeDropsReservation({
        status: stored.status,
        ownerId,
        holderId,
        previousVisibility: stored.visibility,
        nextVisibility: visibility,
        // The same relation facts the write uses; friendship may change between
        // the preflight and the write, which is why the write checks again.
        relations: await relationshipReader.relationsBetween(holderId, ownerId),
      }),
    },
  };
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
