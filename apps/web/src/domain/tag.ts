// AD-22 / Story 2.5: fixed catalog tags and custom tags approved by ADMIN may
// enter aggregates. A custom text stays out until approval (Story 10.2). The
// predicate lives here so aggregate reads cannot inline a weaker check.

import {
  DEFAULT_LOCALE,
  type GiftCard,
  type SupportedLocale,
  type TagCatalogItem,
} from "@gift-list/contracts";

/** Minimal shape of a `GiftTag` row needed to decide aggregate eligibility. */
export type GiftTagAggregateState = {
  /** Catalog tag linked by ADMIN approval; null while the row is custom-only. */
  tagId: string | null;
  /**
   * True for fixed catalog tags and for custom tags after ADMIN approval;
   * false for an unmoderated custom text.
   */
  aggregateEligible: boolean;
};

/**
 * Both facts are required: approval (Story 10.2) links the row to a catalog tag
 * and marks it eligible. A row with only the flag was never normalized, so it
 * must not reach aggregates.
 *
 * This answers the moderation half only. The aggregate query must still apply
 * VisibilityPolicy: AD-22 keeps wishes with `visibility=SECRET` out of every
 * aggregate regardless of their tags.
 */
export function isGiftTagApprovedForAggregates(tag: GiftTagAggregateState): boolean {
  return tag.tagId !== null && tag.aggregateEligible;
}

/** Catalog row from the database: `labels` is untyped JSON until checked here. */
export type TagCatalogRow = {
  readonly id: string;
  readonly slug: string;
  readonly labels: unknown;
};

function isLabelMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyLabel(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * AD-27: the server picks the label for the request language from the row's
 * `labels`. A missing or malformed requested label falls back to
 * `DEFAULT_LOCALE`, never to a caption baked into code.
 *
 * The database CHECK only requires `labels` to be a JSON object; the seed keeps
 * `ru` present, while full per-locale validation belongs to the ADMIN form
 * (Story 10.2). An empty string therefore means a row without any usable label:
 * the catalog read drops such a row instead of shipping a blank caption.
 */
export function pickTagLabel(labels: unknown, locale: SupportedLocale): string {
  if (!isLabelMap(labels)) return "";

  const localized = labels[locale];
  if (isNonEmptyLabel(localized)) return localized.trim();

  const fallback = labels[DEFAULT_LOCALE];
  return isNonEmptyLabel(fallback) ? fallback.trim() : "";
}

/**
 * F-2.5.3-5: the catalog order is `slug` ascending in Unicode code units, not
 * `createdAt` and not a column collation. Starting slugs therefore read
 * `dream`, `need-now`, `someday`. A manual order would need `sortOrder` in
 * Story 10.2.
 */
export function compareTagCatalogSlugs(
  left: Pick<TagCatalogRow, "slug">,
  right: Pick<TagCatalogRow, "slug">,
): number {
  if (left.slug < right.slug) return -1;
  if (left.slug > right.slug) return 1;
  return 0;
}

/** Only the catalog fields the client needs: no moderation, aggregate or custom metadata. */
export function toTagCatalogItem(row: TagCatalogRow, locale: SupportedLocale): TagCatalogItem {
  return {
    id: row.id,
    slug: row.slug,
    label: pickTagLabel(row.labels, locale),
  };
}

/** The wire shape of one tag on a gift card; no moderation or aggregate state. */
export type GiftTagCard = GiftCard["tags"][number];

/** Minimal shape of a `GiftTag` row the card mapper needs. */
export type GiftTagRow = {
  /** Catalog tag when the row is a fixed tag or an approved custom one. */
  readonly tagId: string | null;
  /** Custom text until ADMIN approval; null for a fixed tag (AD-22). */
  readonly customText: string | null;
  /** Catalog row with the per-language labels; null for an unapproved custom tag. */
  readonly tag: { readonly labels: unknown } | null;
};

/**
 * One tag on the wire (Story 2.5, AD-22, AD-27). A fixed tag carries its
 * `catalogId` and the label for the request language, resolved on the server;
 * the client never keeps fixed captions. A custom tag has no catalog id and
 * shows its own text as stored: user data is not translated. The row exposes
 * only these two fields — `aggregateEligible`, `tagId` and moderation columns
 * never reach the client.
 *
 * An approved custom tag carries both a catalog link and the original text;
 * the catalog label wins, because approval normalised the text into the
 * catalog. A catalog row without any usable label is dropped rather than shown
 * blank, like the catalog read.
 */
export function toGiftTag(row: GiftTagRow, locale: SupportedLocale): GiftTagCard | null {
  if (row.tagId !== null) {
    const label = row.tag === null ? "" : pickTagLabel(row.tag.labels, locale);
    return label === "" ? null : { catalogId: row.tagId, label };
  }

  const text = row.customText?.trim() ?? "";
  return text === "" ? null : { catalogId: null, label: text };
}

/** Card tags in row order, with unusable rows left out. */
export function toGiftTags(rows: readonly GiftTagRow[], locale: SupportedLocale): GiftTagCard[] {
  const tags: GiftTagCard[] = [];
  for (const row of rows) {
    const tag = toGiftTag(row, locale);
    if (tag !== null) tags.push(tag);
  }
  return tags;
}

