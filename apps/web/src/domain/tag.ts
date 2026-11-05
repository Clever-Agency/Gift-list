// AD-22 / Story 2.5: fixed catalog tags and custom tags approved by ADMIN may
// enter aggregates. A custom text stays out until approval (Story 10.2). The
// predicate lives here so aggregate reads cannot inline a weaker check.

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
