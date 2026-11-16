import { z } from "zod";

/**
 * Closed success outcomes of blocking (Story 4.5, FR-24, AD-10 step 4). The wire
 * values are the domain protocol's own vocabulary, so the client never
 * translates a second one: `BLOCKED` inserted the viewer's directed row,
 * `ALREADY_BLOCKED` is its idempotent repeat.
 *
 * Both are successful answers, never errors: a repeated tap must not look like a
 * failure, and the answer never says whether the other person blocked first.
 */
export const BLOCK_OUTCOMES = ["BLOCKED", "ALREADY_BLOCKED"] as const;

export const blockOutcomeSchema = z.enum(BLOCK_OUTCOMES);

export type BlockOutcome = (typeof BLOCK_OUTCOMES)[number];

/** Success payload of `POST /api/v1/u/:nick/block`. */
export const blockDataSchema = z.strictObject({
  outcome: blockOutcomeSchema,
});

export type BlockData = z.infer<typeof blockDataSchema>;

/**
 * Closed success outcomes of unblocking (Story 4.5, AD-10 step 4): the viewer's
 * own row was removed (`UNBLOCKED`) or was already gone (`NOT_BLOCKED`).
 *
 * A reverse block belongs to the other person and stays; the answer says nothing
 * about it, so `NOT_BLOCKED` never reveals that the other side blocked first.
 */
export const UNBLOCK_OUTCOMES = ["UNBLOCKED", "NOT_BLOCKED"] as const;

export const unblockOutcomeSchema = z.enum(UNBLOCK_OUTCOMES);

export type UnblockOutcome = (typeof UNBLOCK_OUTCOMES)[number];

/** Success payload of `DELETE /api/v1/u/:nick/block`. */
export const unblockDataSchema = z.strictObject({
  outcome: unblockOutcomeSchema,
});

export type UnblockData = z.infer<typeof unblockDataSchema>;

/**
 * One row of «Заблокированные» (Story 4.5.2; the settings section of
 * EXPERIENCE shows the name and the @nick). `relationship`, `subscribed` and
 * `followsYou` of the circle rows are absent on purpose: a block deletes the
 * edge and both subscriptions, so a relation here could only describe the
 * reverse block, which is never revealed. The internal id, email and the block
 * time are cursor business and stay off the wire.
 */
export const blockedCardSchema = z.strictObject({
  displayName: z.string(),
  nick: z.string(),
});

export type BlockedCard = z.infer<typeof blockedCardSchema>;

/** One page of the list: the rows, the opaque next cursor (`null` on the last page) and the full count. */
export const blockedPageSchema = z.strictObject({
  items: z.array(blockedCardSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().min(0),
});

export type BlockedPage = z.infer<typeof blockedPageSchema>;

/**
 * `GET /api/v1/me/blocks?cursor=` query. The cursor is the `nextCursor` of the
 * previous page and stays opaque; a value the domain did not issue is
 * `VALIDATION` with `field: "cursor"`, exactly like the circle lists. The screen
 * has no search field, so there is no `q` here.
 */
export const blockedListQuerySchema = z.strictObject({
  cursor: z.string().optional(),
});

export type BlockedListQuery = z.infer<typeof blockedListQuerySchema>;
