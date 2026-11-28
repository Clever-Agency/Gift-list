import "server-only";

import {
  DEFAULT_LOCALE,
  type CustomTagApproval,
  type CustomTagQueueItem,
  type TagCatalogItem,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import {
  compareTagCatalogSlugs,
  customTagRowIdsToLink,
  groupCustomTagQueue,
  normalizeCustomTagText,
  toTagCatalogItem,
  type TagCatalogRow,
} from "@/domain/tag";

/**
 * Story 10.2 / AD-22: what one normalized text was decided to. Only the
 * moderation store and the custom-tag write path read it; nothing reaches a
 * client.
 */
export type CustomTagDecisionRow = {
  readonly decision: "APPROVED" | "REJECTED";
  readonly tagId: string | null;
};

/**
 * Decisions for the given custom texts, keyed by the normalized text. The write
 * path calls this for every gift with a custom tag, so a text approved earlier
 * is linked to its catalog tag immediately; a rejected one stays custom. An
 * empty input reads nothing.
 *
 * `db` is a transaction client on the edit path, so the lookup sees the same
 * snapshot as the tag replacement; the create path passes the client itself.
 */
export async function readCustomTagDecisions(
  db: Prisma.TransactionClient,
  texts: readonly string[],
): Promise<Map<string, CustomTagDecisionRow>> {
  if (texts.length === 0) return new Map();

  const keys = Array.from(
    new Set(
      texts.map(function normalize(text) {
        return normalizeCustomTagText(text);
      }),
    ),
  ).filter(function isNotEmpty(key) {
    return key !== "";
  });
  if (keys.length === 0) return new Map();

  const rows = await db.customTagModeration.findMany({
    where: { normalizedText: { in: keys } },
    select: { normalizedText: true, decision: true, tagId: true },
  });

  return new Map(
    rows.map(function decisionEntry(row) {
      return [row.normalizedText, { decision: row.decision, tagId: row.tagId }];
    }),
  );
}

/**
 * Story 10.2: the `/admin/tags` queue. Every undecided custom text on wishes
 * that are not `SECRET` (AD-22 keeps secret wishes out of every admin view),
 * grouped by the normalized text. The read carries no owner, wish id or title.
 *
 * Archived wishes are counted: their rows still exist and a decision must cover
 * them too, otherwise their text could never become a catalog tag. Deleted wishes
 * leave no rows (the tag rows cascade with the gift).
 *
 * Prisma cannot group by a value computed in JS, so the rows are read and
 * grouped in the domain. A moderation queue is a few hundred texts at most; a
 * database index on `lower(customText)` would be the next step if it grows.
 */
export async function listCustomTagQueue(): Promise<CustomTagQueueItem[]> {
  const [rows, decisions] = await Promise.all([
    prisma.giftTag.findMany({
      where: {
        tagId: null,
        customText: { not: null },
        gift: { visibility: { not: "SECRET" } },
      },
      select: { giftId: true, customText: true },
    }),
    prisma.customTagModeration.findMany({ select: { normalizedText: true } }),
  ]);

  return groupCustomTagQueue(
    rows,
    decisions.map(function decidedText(row) {
      return row.normalizedText;
    }),
  );
}

/**
 * Story 10.2 (AD-27): the catalog tags an ADMIN can approve into. Reuses the
 * catalog mapping of `GET /api/v1/tags` and resolves the caption in
 * `DEFAULT_LOCALE`, because the admin panel is Russian-only today. A row without
 * a usable caption is left out, exactly like the public catalog.
 */
export async function listTagCatalogForAdmin(): Promise<TagCatalogItem[]> {
  const rows: TagCatalogRow[] = await prisma.tag.findMany({
    select: { id: true, slug: true, labels: true },
  });

  return rows
    .map(function mapRow(row) {
      return toTagCatalogItem(row, DEFAULT_LOCALE);
    })
    .filter(function hasLabel(tag) {
      return tag.label !== "";
    })
    .sort(compareTagCatalogSlugs);
}

/** Approval outcomes a server action turns into the AD-12 envelope. */
export type ApproveCustomTagOutcome =
  | { readonly ok: true; readonly tagId: string; readonly linkedTags: number }
  | {
      readonly ok: false;
      readonly reason: "ALREADY_DECIDED" | "SLUG_TAKEN" | "TAG_MISSING" | "EMPTY_TEXT";
    };

/** Rejection outcomes; rejection never touches a `GiftTag` row. */
export type RejectCustomTagOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "ALREADY_DECIDED" | "EMPTY_TEXT" };

/**
 * Story 10.2: approve one queue text — into a new catalog tag (`slug` plus a
 * caption for every supported language) or into an existing one. One transaction:
 * the decision row, the catalog tag and every matching `GiftTag` row.
 *
 * Linking sets `tagId` and `aggregateEligible = true` and keeps `customText`:
 * the wish card then shows the catalog label (see `toGiftTag`), and user text is
 * not deleted. A wish that already has the catalog tag is skipped, and so is a
 * second case variant of the same text on one wish — both would violate
 * `(giftId, tagId)`. Those rows stay custom-only, but the decision hides their
 * text from the queue.
 *
 * A second decision on the same text is refused (`ALREADY_DECIDED`), whether it
 * arrives from a stale screen or concurrently: the UNIQUE index on
 * `normalizedText` rejects the loser and the transaction leaves no half-written
 * tag behind.
 */
export async function approveCustomTag(
  input: CustomTagApproval,
): Promise<ApproveCustomTagOutcome> {
  const normalizedText = normalizeCustomTagText(input.normalizedText);
  if (normalizedText === "") return { ok: false, reason: "EMPTY_TEXT" };

  try {
    return await prisma.$transaction(async function approve(tx) {
      const decided = await tx.customTagModeration.findUnique({
        where: { normalizedText },
        select: { id: true },
      });
      if (decided !== null) return { ok: false as const, reason: "ALREADY_DECIDED" as const };

      let tagId: string;
      if (input.mode === "existing") {
        const tag = await tx.tag.findUnique({
          where: { id: input.tagId },
          select: { id: true },
        });
        if (tag === null) return { ok: false as const, reason: "TAG_MISSING" as const };
        tagId = tag.id;
      } else {
        const clash = await tx.tag.findUnique({
          where: { slug: input.slug },
          select: { id: true },
        });
        if (clash !== null) return { ok: false as const, reason: "SLUG_TAKEN" as const };

        const created = await tx.tag.create({
          data: { slug: input.slug, labels: input.labels },
          select: { id: true },
        });
        tagId = created.id;
      }

      const rows = await tx.giftTag.findMany({
        where: { tagId: null, customText: { not: null } },
        select: { id: true, giftId: true, customText: true },
      });
      const giftsWithTag =
        rows.length === 0
          ? []
          : await tx.giftTag.findMany({
              where: {
                tagId,
                giftId: {
                  in: Array.from(
                    new Set(
                      rows.map(function giftIdOf(row) {
                        return row.giftId;
                      }),
                    ),
                  ),
                },
              },
              select: { giftId: true },
            });

      const ids = customTagRowIdsToLink(
        rows,
        normalizedText,
        new Set(
          giftsWithTag.map(function giftIdOf(row) {
            return row.giftId;
          }),
        ),
      );
      if (ids.length > 0) {
        await tx.giftTag.updateMany({
          where: { id: { in: ids } },
          data: { tagId, aggregateEligible: true },
        });
      }

      await tx.customTagModeration.create({
        data: { normalizedText, decision: "APPROVED", tagId },
      });

      return { ok: true as const, tagId, linkedTags: ids.length };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const decided = await prisma.customTagModeration.findUnique({
        where: { normalizedText },
        select: { id: true },
      });
      if (decided !== null) return { ok: false, reason: "ALREADY_DECIDED" };
      // The only other unique key here is the slug, checked before the insert
      // but reachable by a concurrent approval.
      return { ok: false, reason: input.mode === "new" ? "SLUG_TAKEN" : "ALREADY_DECIDED" };
    }
    throw error;
  }
}

/**
 * Story 10.2: reject one queue text. Only the decision row is written: every
 * `GiftTag` row keeps its text and `aggregateEligible = false`, so the caption
 * stays on the wishes and never enters aggregates. A repeated decision is
 * refused, not overwritten.
 */
export async function rejectCustomTag(normalizedText: string): Promise<RejectCustomTagOutcome> {
  const key = normalizeCustomTagText(normalizedText);
  if (key === "") return { ok: false, reason: "EMPTY_TEXT" };

  try {
    await prisma.customTagModeration.create({
      data: { normalizedText: key, decision: "REJECTED" },
    });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "ALREADY_DECIDED" };
    throw error;
  }
}

/** PostgreSQL unique violation, as Prisma reports it. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
