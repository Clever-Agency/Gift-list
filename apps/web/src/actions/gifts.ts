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
import { calendarDay, calendarDayToDate, isBeforeLocalToday } from "@/domain/calendar-day";
import { changedGiftFields, type GiftEditEventField } from "@/domain/gift-edit";
import {
  hasActiveReservation,
  visibilityChangeDropsReservation,
  type GiftStatusEvent,
} from "@/domain/gift-status";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";
import { NO_RELATIONS, VisibilityPolicy } from "@/domain/visibility";
import { firstIssueField } from "@/lib/api-v1";
import { auth } from "@/lib/auth";
import { giftStatusTransaction, recordGiftEvent } from "@/lib/gift-status-store";
import { enqueueGiftNotification, notificationGiftSnapshot } from "@/lib/notification-store";
import { relationshipReader } from "@/lib/relationships";

export const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

export const notFound = {
  ok: false as const,
  code: "NOT_FOUND" as const,
  message: "Gift not found",
};

/**
 * AD-8 (ред. 2026-11-11, CLE-82): the owner's archived wish is read-only, and
 * the reason lets the client show «Архивное желание можно только просматривать».
 * A foreign archived wish still answers NOT_FOUND, so this never confirms that
 * somebody else's wish exists (AD-7).
 *
 * Exported for the Story 5.3 close use-case: closing an archived wish is refused
 * with the same reason, so both writes answer one body.
 */
export const archivedValidation = {
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

/**
 * Columns the owner card reads; the same shape the list read selects (AD-12).
 * D-49: the owner never sees a reservation, so the reservation columns
 * (`reservedBy`, phase, toggles) are not read here at all.
 */
export const ownerGiftSelect = {
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
  // Story 5.3: read only to compute the owner's `undoUntil`.
  closedAt: true,
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
 * AD-8 (status and archive), CLE-82 (`visibility`, holder), Story 2.6
 * (`expiresOn` plus the owner's zone) and Story 5.4 (the significant fields the
 * edit event compares against).
 */
const storedGiftSelect = {
  updatedAt: true,
  title: true,
  description: true,
  linkUrl: true,
  priceAmount: true,
  priceCurrency: true,
  status: true,
  visibility: true,
  quantity: true,
  archivedAt: true,
  reservedById: true,
  expiresOn: true,
  list: { select: { owner: { select: { timeZone: true } } } },
} satisfies Prisma.GiftSelect;

/**
 * What the visibility preflight reads: ownership, the archive and the closed
 * state. D-49: the reservation columns are not read at all, because the answer
 * cannot depend on a reservation.
 */
const previewGiftSelect = {
  status: true,
  archivedAt: true,
} satisfies Prisma.GiftSelect;

export function validation(field?: string): ActionResult<GiftCard> {
  return {
    ok: false,
    code: "VALIDATION",
    message: "Invalid input",
    ...(field ? { field } : {}),
  };
}

/** The wire day is a string; the column is a date. An unchanged field is absent. */
function toStoredGiftFields<T extends { expiresOn?: string | null }>(fields: T) {
  if (fields.expiresOn === undefined) return fields;
  const { expiresOn, ...rest } = fields;
  return {
    ...rest,
    expiresOn: expiresOn === null ? null : calendarDayToDate(expiresOn),
  };
}

/** AD-27: fixed tag labels follow the request language, like the catalog read. */
export function requestLocale(headers: Headers): SupportedLocale {
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

/**
 * Raised inside a transaction when a fixed tag id matches no catalog row. The
 * index is the position in the request's `tags` array (CLE-79/D3).
 */
class MissingCatalogTagError extends Error {
  readonly index: number;

  constructor(index: number) {
    super("A fixed tag id is not in the catalog");
    this.index = index;
  }
}

/**
 * CLE-79/D3: the client shows «Такого тега больше нет в списке» only for a
 * `tags.N.catalogId` field, so a stale fixed tag names its index in the request
 * array instead of the whole `tags` key (custom text keeps its position).
 */
function catalogTagField(index: number): string {
  return `tags.${index}.catalogId`;
}

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
 *
 * CLE-79/D3: answers the index of the first missing fixed tag in the request's
 * `tags` array (the same order `toTagRows` writes), so the caller can point the
 * error at `tags.N.catalogId`; `null` means every fixed id is in the catalog.
 */
async function firstMissingFixedTagIndex(
  db: Prisma.TransactionClient,
  tags: readonly GiftTagInput[],
): Promise<number | null> {
  const catalogIds = tags.flatMap(function catalogIdOf(tag) {
    return "catalogId" in tag ? [tag.catalogId] : [];
  });
  if (catalogIds.length === 0) return null;

  const found = await db.tag.findMany({
    where: { id: { in: catalogIds } },
    select: { id: true },
  });
  const known = new Set(
    found.map(function idOf(row) {
      return row.id;
    }),
  );
  const missingIndex = tags.findIndex(function isMissing(tag) {
    return "catalogId" in tag && !known.has(tag.catalogId);
  });
  return missingIndex === -1 ? null : missingIndex;
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
    select: { id: true, owner: { select: { timeZone: true } } },
  });
  if (!list) return { ok: false, code: "NOT_FOUND", message: "Wishlist not found" };

  // Story 2.6: a new date before the owner's local today is rejected. Today is
  // allowed. An omitted date stays unset and is not checked.
  if (
    parsed.data.expiresOn !== null &&
    isBeforeLocalToday(parsed.data.expiresOn, new Date(), list.owner?.timeZone ?? null)
  ) {
    return validation("expiresOn");
  }

  const tags = parsed.data.tags;
  const missingTagIndex = await firstMissingFixedTagIndex(prisma, tags);
  if (missingTagIndex !== null) return validation(catalogTagField(missingTagIndex));

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
        expiresOn:
          parsed.data.expiresOn === null ? null : calendarDayToDate(parsed.data.expiresOn),
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
 * transaction as the visibility write, and the holder gets their
 * `RESERVATION_RELEASED` line; widening it later does not bring the reservation
 * back. The AD-7 evaluation deliberately does not use the A-14 reservation-card
 * exception, and it counts the list link as available.
 *
 * D-49 (CLE-124): the owner never learns about a reservation, so the write no
 * longer guards `OPEN` vs `RESERVED` — it writes the snapshot it read and lets
 * `updatedAt` catch any change made in between. A reservation that lands while
 * the owner edits therefore leads to a fresh read and a repeated attempt
 * (`MAX_UPDATE_ATTEMPTS`), never to a CONFLICT or a VALIDATION the owner could
 * read as a reservation. The release decision is taken on the row of that
 * attempt, so a holder who keeps access keeps the reservation.
 *
 * Story 2.5 (FR-41, D-25): `quantity` names how many times a wish may be given.
 * A change is allowed while the wish is editable (`OPEN` or `RESERVED`, D-49:
 * решение 3) and is written without touching the reservation; `CLOSED` and an
 * archived wish stay read-only through the VALIDATION above. Changing only
 * `quantity` is not a significant field, so it reports nothing to the holder; a
 * reservation may also stay live on an `UNLIMITED` wish, while a new reservation
 * of an `UNLIMITED` wish is still refused (`canReserveGift`).
 *
 * Story 5.4 (FR-31): an edit of a `RESERVED` wish reports one `GIFT_EDITED` event
 * after the commit, carrying only the names of the significant fields that really
 * changed (`title`, `description`, `linkUrl`, `price`). A resent value, a tag, an
 * `expiresOn` or `quantity` change and an `OPEN` wish give no event; a PATCH that
 * takes the holder's access away releases the reservation and gives no edit
 * event either, even when it changed a significant field in the same write.
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

  for (let attempt = 1; ; attempt += 1) {
    // Story 5.4: the significant fields the current attempt really changes. It is
    // reassigned only by a committed attempt and reset here, so a lost write never
    // leaves a stale list for the retry to report twice.
    let editedFields: GiftEditEventField[] = [];

    try {
      const result = await prisma.$transaction(async function updateOwnGift(tx) {
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

        // Story 2.5/FR-41 (D-49, решение 3): `quantity` is writable while the wish
        // is editable, so a reserved wish may switch «Один раз» ↔ «Можно дарить
        // снова». The reservation is not touched and a change of `quantity` alone
        // is not a significant field (see `changedGiftFields`). The form of the
        // same wish resends the stored value; that is not a change.
        if (fields.quantity !== undefined && stored.quantity === fields.quantity) {
          delete fields.quantity;
        }

        // FR-10 ред. 2026-11-11: visibility is writable at OPEN and RESERVED. A
        // narrowing that drops the holder's AD-7 access releases the reservation
        // in this same transaction; the preflight of S23.3 repeats this rule.
        // D-49: the decision is taken on the row this attempt read — a reservation
        // that landed in between is seen by the fresh read of the retry, and the
        // holder gets their own line only when the release really happens.
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

        // Story 5.4 (FR-31): what a `RESERVED` wish reports to the holder. The
        // comparison is on the values the write will store — an absent key keeps
        // the stored one, so a resent value is not a change — and it is skipped
        // when this same PATCH releases the reservation by narrowing visibility:
        // the holder then gets the release line instead, and an «owner changed the
        // wish» line would speak about something they can no longer see.
        const editFields =
          hasActiveReservation(stored) && !dropsReservation
            ? changedGiftFields(
                {
                  title: stored.title,
                  description: stored.description,
                  linkUrl: stored.linkUrl,
                  priceAmount: stored.priceAmount,
                  priceCurrency: stored.priceCurrency,
                },
                {
                  title: fields.title ?? stored.title,
                  description:
                    fields.description === undefined ? stored.description : fields.description,
                  linkUrl: fields.linkUrl === undefined ? stored.linkUrl : fields.linkUrl,
                  priceAmount:
                    fields.priceAmount === undefined ? stored.priceAmount : fields.priceAmount,
                  priceCurrency:
                    fields.priceCurrency === undefined
                      ? stored.priceCurrency
                      : fields.priceCurrency,
                },
              )
            : [];

        // Story 2.6: resending the stored day is not a new date, even when that
        // day is already in the past. Only a different day is checked.
        if (fields.expiresOn !== undefined) {
          const next = fields.expiresOn ?? null;
          if (next === calendarDay(stored.expiresOn)) {
            delete fields.expiresOn;
          } else if (
            next !== null &&
            isBeforeLocalToday(next, new Date(), stored.list.owner.timeZone)
          ) {
            return validation("expiresOn");
          }
        }

        // Fail fast on an unknown catalog tag: nothing is written for a bad body.
        if (tags !== undefined) {
          const missingTagIndex = await firstMissingFixedTagIndex(tx, tags);
          if (missingTagIndex !== null) throw new MissingCatalogTagError(missingTagIndex);
        }

        // AD-8/AD-9 + D-49: the write lands only on the snapshot the decision
        // above was taken from, and the snapshot is `updatedAt` alone — not the
        // status or the holder. A reservation that landed in between changes
        // `updatedAt` too, so the write fails, the transaction is repeated and the
        // fresh read decides again; the owner's answer never depends on whether
        // the wish is open or reserved. An archive or a close also moves
        // `updatedAt`, and the retry then answers with their own VALIDATION.
        const updated = await tx.gift.update({
          where: {
            id: giftId,
            archivedAt: null,
            updatedAt: stored.updatedAt,
          },
          data: toStoredGiftFields(fields),
          select: { id: true },
        });

        // AD-8: status and the reservation columns are written only by the service.
        if (dropsReservation || editFields.length > 0) {
          const snapshot = await notificationGiftSnapshot(tx, updated.id);
          if (dropsReservation) {
            const released = await giftStatusTransaction(tx).releaseReservation(updated.id);
            if (released) await enqueueGiftNotification(tx, snapshot, {
              kind: "RESERVATION_RELEASED", role: "holder", email: true, at: new Date(),
            });
          } else {
            await enqueueGiftNotification(tx, snapshot, {
              kind: "GIFT_EDITED", role: "holder", email: true, at: new Date(), fields: editFields,
            });
          }
        }

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

        editedFields = editFields;
        return {
          ok: true as const,
          data: giftCardSchema.parse(toOwnerGiftCard(row, requestLocale(headers))),
        };
      });

      // Story 5.4 (NFR-6): the edit is reported only after the commit, and only
      // when the holder could still see the wish and a significant field really
      // changed. The line carries names only — no titles, no values (FR-31).
      if (editedFields.length > 0) {
        recordGiftEvent({
          giftId,
          actorId: ownerId,
          at: new Date(),
          kind: "GIFT_EDITED",
          fields: editedFields,
        });
      }
      return result;
    } catch (error) {
      if (error instanceof MissingCatalogTagError) {
        return validation(catalogTagField(error.index));
      }

      if (tags !== undefined) {
        const tagFailure = tagWriteFailure(error);
        if (tagFailure) return tagFailure;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        // The snapshot moved under the write. Re-read to tell a wish that is now
        // read-only from one that merely needs a fresh snapshot: an archive or a
        // close is VALIDATION, a deleted or foreign id is NOT_FOUND, and anything
        // else — a reservation, a release, another edit — repeats the attempt
        // (D-49: the owner's answer never depends on the reservation).
        const current = await prisma.gift.findFirst({
          where: { id: giftId, list: { ownerId } },
          select: { status: true, archivedAt: true },
        });
        if (current === null) return notFound;
        if (current.archivedAt !== null) return archivedValidation;
        if (current.status === "CLOSED") return closedValidation;

        // The wish is still editable. Its status, holder or other fields changed
        // since the snapshot, so re-run the transaction and let the visibility
        // rule meet the reservation that actually exists. A reservation is never
        // a reason to answer NOT_FOUND or VALIDATION — the wish is there.
        if (attempt < MAX_UPDATE_ATTEMPTS) continue;
        return visibilityRaceConflict;
      }
      throw error;
    }
  }
}

/**
 * CLE-82/S23.2 (FR-10 ред. 2026-11-11, AD-7, D-49): preflight of a visibility
 * change on the owner's wish. It writes nothing and reads no reservation: the
 * owner never learns that a reservation exists, so the field of the closed
 * `GiftVisibilityPreview` contract is always `false` and the reservation is never
 * mentioned. The write still repeats the AD-7 rule inside its transaction.
 *
 * Ownership masks a foreign or missing wish as NOT_FOUND; the owner's own
 * archived or closed wish answers VALIDATION with its reason, like the write —
 * those are facts the owner already knows.
 */
export async function previewGiftVisibility(
  headers: Headers,
  giftId: string,
  visibility: GiftVisibilityValue,
): Promise<ActionResult<GiftVisibilityPreview>> {
  // The value is part of the route contract and is deliberately not read: the
  // answer is the same for every change (D-49).
  void visibility;
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

  return { ok: true, data: { wouldCancelReservation: false } };
}

/**
 * Story 5.4 / D-49: the row kept moving under the delete for every attempt. No
 * `reason`: the client reloads the wish. A reservation is never the reason — it
 * is released and the delete retried inside the transaction (CLE-124).
 */
const deleteConflict = {
  ok: false as const,
  code: "CONFLICT" as const,
  message: "The wish changed while deleting",
};

/** The outcome of the delete transaction; the event is reported after the commit. */
type DeleteGiftOutcome =
  | { readonly kind: "not-found" }
  | { readonly kind: "conflict" }
  | { readonly kind: "deleted"; readonly event: GiftStatusEvent | null };

/**
 * Story 5.4 (R1): an internal rollback signal of the delete transaction. Returning
 * a value from an interactive transaction commits it, so a `DELETE` that matched
 * nothing after this transaction had already released the reservation would keep
 * that release and leave the wish `OPEN` with the holder's reservation silently
 * gone. Throwing rolls the whole transaction back; the use-case turns the signal
 * into the same NOT_FOUND / CONFLICT answer outside, where nothing was written.
 */
class DeleteGiftRollback extends Error {
  constructor(readonly outcome: "not-found" | "conflict") {
    super(`deleteGift rolled back: ${outcome}`);
    this.name = "DeleteGiftRollback";
  }
}

/**
 * D-49 (CLE-124): how many times the delete re-reads and repeats when a
 * reservation lands between its release and the `DELETE`. The attempt is
 * internal: the owner never sees a CONFLICT born of a reservation.
 */
const MAX_DELETE_ATTEMPTS = 3;

/** The gift row a `GIFT_DELETED` line is enqueued from; it is gone by then. */
type GiftSnapshot = NonNullable<Awaited<ReturnType<typeof notificationGiftSnapshot>>>;

/**
 * Story 2.3 (FR-10), Story 5.3 (FR-32), Story 5.4 (FR-17, AD-9), D-49: the owner
 * deletes a wish of their own list that is not archived — `OPEN`, `RESERVED` or
 * `CLOSED` (a received wish can be removed from the list too).
 *
 * Everything happens in one transaction (`Design Notes`): the row is read inside
 * the owner's list, so a foreign, missing or archived id matches nothing; a
 * `RESERVED` row is taken off through `GiftStatusService` (`releaseReservation`,
 * CAS `status = RESERVED`), which is the only writer of the reservation columns;
 * then `deleteMany` carries ownership, "not archived" and a deletable status.
 *
 * D-49: the owner never learns about a reservation, so a reservation that lands
 * between the release and the `DELETE` (or between the read and the release) is
 * not a CONFLICT. The transaction re-reads the row and repeats
 * (`MAX_DELETE_ATTEMPTS`): the new holder is released too and the wish is
 * deleted. Only a row that keeps moving under the delete for every attempt is a
 * CONFLICT, and that is the same answer an unreadable race gives without a
 * reservation.
 *
 * Story 5.4 (NFR-6): after the commit exactly one `GIFT_DELETED` event is written,
 * and only when this transaction really made a `RESERVED → OPEN` transition. A
 * release somebody else made leaves no line: the deletion did not make that
 * transition. `OPEN` and `CLOSED` never write one — the closure of 5.3 is already
 * recorded. The event carries identifiers only (FR-31). The holder of every
 * reservation this delete removed gets their own `GIFT_DELETED` line and email.
 *
 * A `DELETE` that matched nothing after this transaction released a reservation
 * throws {@link DeleteGiftRollback} instead of returning: the release must not
 * survive a delete that did not happen (Story 5.4, R1). No release was made on the
 * `OPEN`/`CLOSED` path, so there the answer is simply returned.
 */
export async function deleteGift(
  headers: Headers,
  giftId: string,
): Promise<ActionResult<{ id: string }>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const ownerId = session.user.id;

  const deleteRun = prisma.$transaction(
    async function deleteOwnGift(tx): Promise<DeleteGiftOutcome> {
      // Every holder whose reservation this transaction removed, with its
      // snapshot for the line and the email. The released row no longer knows
      // them, so the snapshot is taken before the release (FR-31: id only).
      const released: { snapshot: GiftSnapshot; at: Date }[] = [];
      let recipientId: string | null = null;

      for (let attempt = 1; attempt <= MAX_DELETE_ATTEMPTS; attempt += 1) {
        const stored = await tx.gift.findFirst({
          where: { id: giftId, archivedAt: null, list: { ownerId } },
          select: { status: true, reservedById: true },
        });
        if (!stored) {
          // The row is gone: an earlier release of this transaction must not
          // survive it, so the answer is produced outside the rolled-back work.
          if (released.length > 0) throw new DeleteGiftRollback("not-found");
          return { kind: "not-found" };
        }

        if (stored.status === "RESERVED") {
          const snapshot = await notificationGiftSnapshot(tx, giftId);
          const done = await giftStatusTransaction(tx).releaseReservation(
            giftId,
            snapshot?.reservedAt,
          );
          // Released or moved by somebody else in the meantime: read the row that
          // is actually there and decide again.
          if (!done) continue;
          if (snapshot !== null) released.push({ snapshot, at: new Date() });
          recipientId = snapshot?.reservedById ?? stored.reservedById;
        }

        const { count } = await tx.gift.deleteMany({
          where: {
            id: giftId,
            archivedAt: null,
            status: { in: ["OPEN", "CLOSED"] },
            list: { ownerId },
          },
        });
        // A reservation landed between the release and the `DELETE` (D-49): the
        // row is read again, its holder released and the delete repeated. The
        // reservation is never deleted without its holder's line.
        if (count !== 1) continue;

        for (const release of released) {
          await enqueueGiftNotification(tx, release.snapshot, {
            kind: "GIFT_DELETED", role: "holder", email: true, at: release.at,
          });
        }
        if (recipientId === null) return { kind: "deleted", event: null };
        return {
          kind: "deleted",
          event: {
            giftId,
            actorId: ownerId,
            from: "RESERVED",
            to: "OPEN",
            at: new Date(),
            kind: "GIFT_DELETED",
            recipientId,
          },
        };
      }

      // The row kept moving under every attempt. If a release was made, it must
      // not commit with a CONFLICT answer.
      if (released.length > 0) throw new DeleteGiftRollback("conflict");
      return { kind: "conflict" };
    },
  );
  /**
   * The rollback signal of {@link DeleteGiftRollback} becomes the ordinary answer
   * here, after the transaction is over: the release did not commit with it, so
   * the client reloads and repeats the delete with the preflight.
   */
  const outcome = await deleteRun.catch(
    function rollbackAnswer(error: unknown): DeleteGiftOutcome {
      if (error instanceof DeleteGiftRollback) return { kind: error.outcome };
      throw error;
    },
  );

  if (outcome.kind === "not-found") return notFound;
  if (outcome.kind === "conflict") return deleteConflict;
  if (outcome.event !== null) recordGiftEvent(outcome.event);
  return { ok: true, data: { id: giftId } };
}
