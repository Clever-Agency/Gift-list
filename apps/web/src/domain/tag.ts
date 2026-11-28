// AD-22 / Story 2.5: fixed catalog tags and custom tags approved by ADMIN may
// enter aggregates. A custom text stays out until approval (Story 10.2). The
// predicate lives here so aggregate reads cannot inline a weaker check.

import {
  DEFAULT_LOCALE,
  type CustomTagQueueItem,
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
  /**
   * Catalog row with the per-language labels; null for an unapproved custom tag.
   * `slug` is the immutable catalog key used for display order; reads select it
   * (`GiftCard` itself never carries it).
   */
  readonly tag: { readonly labels: unknown; readonly slug: string } | null;
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

/**
 * Card tags in display order, with unusable rows left out.
 *
 * Story 2.5 / CLE-77: the order is deterministic and independent of row insertion.
 * Unapproved custom tags come first, so fixed tags cannot push a custom tag
 * behind the card's «+N» (`EXPERIENCE.md` → Tags). They ascend by stored text
 * in Unicode code units. Fixed tags follow, ascending by the immutable catalog
 * `slug` in code units — the same order as `GET /api/v1/tags`
 * (`compareTagCatalogSlugs`). An approved custom tag is a fixed tag and sorts
 * there too. No locale collation and no translated label is used for sorting.
 * Catalog and custom uniques
 * (`@@unique([giftId, tagId])`, `@@unique([giftId, customText])`) make equal keys
 * unreachable; the final input-index tie-break only keeps the sort stable.
 */
export function toGiftTags(rows: readonly GiftTagRow[], locale: SupportedLocale): GiftTagCard[] {
  const ordered: {
    tag: GiftTagCard;
    fixed: boolean;
    key: string;
    index: number;
  }[] = [];

  rows.forEach(function collectTag(row, index) {
    const tag = toGiftTag(row, locale);
    if (tag === null) return;
    const fixed = tag.catalogId !== null;
    ordered.push({
      tag,
      fixed,
      key: fixed ? (row.tag?.slug ?? tag.catalogId ?? "") : tag.label,
      index,
    });
  });

  ordered.sort(compareCardTags);
  return ordered.map(function cardTag(entry) {
    return entry.tag;
  });
}

/** Unicode code units, not `Intl.Collator`: the catalog order is language-independent. */
function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareCardTags(
  left: { tag: GiftTagCard; fixed: boolean; key: string; index: number },
  right: { tag: GiftTagCard; fixed: boolean; key: string; index: number },
): number {
  if (left.fixed !== right.fixed) return left.fixed ? 1 : -1;

  const byKey = compareCodeUnits(left.key, right.key);
  if (byKey !== 0) return byKey;

  const byIdentity = compareCodeUnits(
    left.tag.catalogId ?? left.tag.label,
    right.tag.catalogId ?? right.tag.label,
  );
  return byIdentity !== 0 ? byIdentity : left.index - right.index;
}

/**
 * Story 10.2: the key of a custom tag text in moderation. The write path only
 * trims (Story 2.5.4), so the queue and the decisions invent one more step here:
 * NFC, trim, collapse any whitespace run to one space, lower case per the `ru`
 * locale. "Айфон", " айфон " and "Айфон  Pro" therefore group as "айфон" and
 * "айфон pro". The stored `customText` is never rewritten — user data stays as
 * typed, and the decision table keeps only the key.
 */
export function normalizeCustomTagText(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("ru");
}

/** A `GiftTag` row the queue groups: only the wish id and the text. */
export type CustomTagQueueRow = {
  readonly giftId: string;
  readonly customText: string | null;
};

/**
 * The most frequent spelling as typed. Ties break on the text in Unicode code
 * units, so the sample is deterministic (no insertion-order dependence).
 */
function pickSampleText(spellings: ReadonlyMap<string, number>): string {
  let best = "";
  let bestCount = -1;
  spellings.forEach(function consider(count, text) {
    if (
      count > bestCount ||
      (count === bestCount && compareCodeUnits(text, best) < 0)
    ) {
      best = text;
      bestCount = count;
    }
  });
  return best;
}

/**
 * Story 10.2: the moderation queue — one line per normalized text, with the
 * number of distinct wishes and the most frequent spelling. Rows already decided
 * are left out. `usageCount` counts wishes, not rows: two case variants on one
 * wish are one use, even though they are two `GiftTag` rows.
 *
 * Order: most used first, then `normalizedText` in Unicode code units.
 */
export function groupCustomTagQueue(
  rows: readonly CustomTagQueueRow[],
  decidedTexts: Iterable<string> = [],
): CustomTagQueueItem[] {
  const decided = new Set(decidedTexts);
  const groups = new Map<
    string,
    { readonly giftIds: Set<string>; readonly spellings: Map<string, number> }
  >();

  rows.forEach(function collectRow(row) {
    if (row.customText === null) return;
    const key = normalizeCustomTagText(row.customText);
    if (key === "" || decided.has(key)) return;

    let group = groups.get(key);
    if (group === undefined) {
      group = { giftIds: new Set(), spellings: new Map() };
      groups.set(key, group);
    }
    group.giftIds.add(row.giftId);
    group.spellings.set(row.customText, (group.spellings.get(row.customText) ?? 0) + 1);
  });

  return Array.from(groups, function toQueueItem([normalizedText, group]) {
    return {
      normalizedText,
      sampleText: pickSampleText(group.spellings),
      usageCount: group.giftIds.size,
    };
  }).sort(function compareQueueItems(left, right) {
    if (left.usageCount !== right.usageCount) return right.usageCount - left.usageCount;
    return compareCodeUnits(left.normalizedText, right.normalizedText);
  });
}

/** A custom `GiftTag` row an approval may link to a catalog tag. */
export type CustomTagLinkRow = {
  readonly id: string;
  readonly giftId: string;
  readonly customText: string | null;
};

/**
 * Story 10.2: ids of the rows an approval links to the catalog tag.
 *
 * All rows carry the normalized text and have no catalog tag yet. Two limits
 * come from the database, not from taste:
 * - `(giftId, tagId)` is unique, so a wish that already has this catalog tag is
 *   skipped: its custom row stays untouched (user data is never deleted);
 * - a wish can hold two case variants of one text (they are different
 *   `customText` values), so at most one of them is linked per wish.
 */
export function customTagRowIdsToLink(
  rows: readonly CustomTagLinkRow[],
  normalizedText: string,
  giftIdsWithTag: ReadonlySet<string>,
): string[] {
  const linkedGifts = new Set(giftIdsWithTag);
  const ids: string[] = [];

  rows.forEach(function considerRow(row) {
    if (row.customText === null) return;
    if (normalizeCustomTagText(row.customText) !== normalizedText) return;
    if (linkedGifts.has(row.giftId)) return;
    linkedGifts.add(row.giftId);
    ids.push(row.id);
  });

  return ids;
}

