// AD-10 step 4 / AD-19 — the block protocol. Rules only: no Prisma, no
// React/Next.js here (AD-1). The caller hands over a `FriendshipStore`; the
// Prisma adapter in `lib/friendship-store.ts` owns the transaction and takes the
// same `lockPair` every invite write takes.
//
// A `Block` is directed: `blockerId → blockedId` is one row, so two people may
// block each other and each side removes only its own row. Reading honours
// either row (`VisibilityPolicy`, circle lists, search); writing forbids either
// row (invite, accept, reject, cancel, unfriend, subscribe).
//
// Blocking deletes the whole pair: the `Friendship` edge, every
// `FriendshipInvite` of both directions and both `Subscription` rows (AD-19). An
// `InviteCooldown` is never written or cleared, and gift reservations are not
// touched (A-14). Unblocking removes one block row and restores nothing.

import { CIRCLE_PAGE_SIZE } from "@gift-list/contracts";
import { orderFriendPair, type FriendshipStore } from "@/domain/friendship";

/** Closed success outcomes of blocking: a new row or the existing one. */
export const BLOCK_OUTCOMES = ["BLOCKED", "ALREADY_BLOCKED"] as const;

export type BlockOutcome = (typeof BLOCK_OUTCOMES)[number];

/**
 * A self block is the closed `FORBIDDEN` refusal, exactly like a self unfriend:
 * the domain only receives an already resolved user id (the action resolves the
 * nick in Story 4.5.2), so there is no `NOT_FOUND` here.
 */
export type BlockResult =
  | { readonly ok: true; readonly outcome: BlockOutcome }
  | { readonly ok: false; readonly code: "FORBIDDEN" };

/** Closed success outcomes of unblocking: the row was removed or was already gone. */
export const UNBLOCK_OUTCOMES = ["UNBLOCKED", "NOT_BLOCKED"] as const;

export type UnblockOutcome = (typeof UNBLOCK_OUTCOMES)[number];

export type UnblockResult =
  | { readonly ok: true; readonly outcome: UnblockOutcome }
  | { readonly ok: false; readonly code: "FORBIDDEN" };

/** The actor (the session) and the person the call is about. */
export type BlockTarget = {
  readonly viewerId: string;
  readonly otherUserId: string;
};

const FORBIDDEN_RESULT = { ok: false, code: "FORBIDDEN" } as const;

/**
 * Block the other person (Story 4.5, AD-10 step 4).
 *
 * One transaction, in this order:
 *
 * 0. the transaction-scoped pair lock comes first, exactly as in send, accept,
 *    reject, cancel and unfriend, so a block cannot interleave with an invite of
 *    the same pair;
 * 1. a self block is refused before the store is touched;
 * 2. the `Friendship` edge and both pending invites of the pair are deleted;
 * 3. both directed `Subscription` rows are deleted (AD-19);
 * 4. `Block(viewer → other)` is inserted idempotently; the directed UNIQUE index
 *    is the last guard, so a race cannot leave two rows.
 *
 * The outcome is `ALREADY_BLOCKED` when the viewer's own row already existed.
 * The sweep still runs in that case, because a race may have left an edge next
 * to the block. A reverse block (`other → viewer`) neither refuses this call nor
 * is reported: both sides may block each other and the answer never says that
 * the other person blocked first. `InviteCooldown` stays untouched, and the
 * blocked pair may invite each other again immediately after an unblock.
 */
export async function blockUser(
  input: BlockTarget,
  store: FriendshipStore,
): Promise<BlockResult> {
  const { viewerId, otherUserId } = input;
  if (viewerId === otherUserId) return FORBIDDEN_RESULT;

  return store.transaction(async function runBlockProtocol(tx) {
    const pair = orderFriendPair(viewerId, otherUserId);
    await tx.lockPair(pair);

    const alreadyBlocked = await tx.findBlock(viewerId, otherUserId);

    await tx.deleteFriendship(pair);
    await tx.deleteInvitesBetween(viewerId, otherUserId);
    await tx.deleteSubscriptionsBetween(viewerId, otherUserId);
    await tx.insertBlock(viewerId, otherUserId);

    return { ok: true, outcome: alreadyBlocked ? "ALREADY_BLOCKED" : "BLOCKED" };
  });
}

/**
 * Remove the viewer's own block (Story 4.5, AD-10 step 4).
 *
 * Only `Block(viewer → other)` is deleted: a reverse block belongs to the other
 * person and stays, so each side decides for itself when to unblock. Nothing is
 * restored — no friendship, no invite, no subscription and no cooldown row — and
 * a missing row is the idempotent `NOT_BLOCKED`. The pair lock is taken for the
 * same reason as in every other pair write: an unblock must not interleave with
 * a block or an invite of the same pair.
 */
export async function unblockUser(
  input: BlockTarget,
  store: FriendshipStore,
): Promise<UnblockResult> {
  const { viewerId, otherUserId } = input;
  if (viewerId === otherUserId) return FORBIDDEN_RESULT;

  return store.transaction(async function runUnblockProtocol(tx) {
    await tx.lockPair(orderFriendPair(viewerId, otherUserId));
    const removed = await tx.deleteBlock(viewerId, otherUserId);
    return { ok: true, outcome: removed ? "UNBLOCKED" : "NOT_BLOCKED" };
  });
}

/** One page of «Заблокированные», the same size as every circle list. */
export const BLOCKED_PAGE_SIZE = CIRCLE_PAGE_SIZE;

/**
 * One row of the «Заблокированные» list: only what the row shows. `blockedAt` is
 * the newest-first key and never leaves the server; there is no avatar, because
 * the circle lists of Story 4.3 do not carry one either.
 */
export type BlockedPerson = {
  readonly id: string;
  readonly displayName: string;
  readonly nick: string;
  readonly blockedAt: Date;
};

/** The two facts the order and the cursor need. */
export type BlockedCursor = Pick<BlockedPerson, "id" | "blockedAt">;

/**
 * The block list read (Story 4.5.2): only people blocked by the viewer
 * (`blockerId = viewerId`). Someone who blocked the viewer is not in this list
 * and must never be revealed by it.
 */
export interface BlockedReader {
  /** Every person the viewer blocked, newest first. */
  readBlockedPeople(viewerId: string): Promise<readonly BlockedPerson[]>;
}

/** The query of the list; `cursor` is the `nextCursor` of the previous page. */
export type BlockedPageQuery = {
  readonly viewerId: string;
  readonly cursor?: string | null;
};

/** One page of the list. `total` is the whole number of own blocks. */
export type BlockedPage = {
  readonly items: readonly BlockedPerson[];
  readonly nextCursor: string | null;
  readonly total: number;
};

/** A cursor this module did not issue is `VALIDATION`, never a silent restart. */
export type BlockedPageResult =
  | ({ readonly ok: true } & BlockedPage)
  | { readonly ok: false; readonly code: "VALIDATION"; readonly reason: "INVALID_CURSOR" };

const INVALID_CURSOR = {
  ok: false,
  code: "VALIDATION",
  reason: "INVALID_CURSOR",
} as const;

/** Ids are CUID2 and the time half is digits, so the separator is unambiguous. */
const CURSOR_SEPARATOR = "|";

/**
 * Newest block first, then the descending CUID2 id. Plain comparison, so the
 * page and its cursor mean the same thing in every locale; two blocks made in
 * the same millisecond still order stably.
 */
export function compareBlockedOrder(left: BlockedCursor, right: BlockedCursor): number {
  const delta = right.blockedAt.getTime() - left.blockedAt.getTime();
  if (delta !== 0) return delta;
  if (left.id === right.id) return 0;
  return left.id < right.id ? 1 : -1;
}

/** The opaque `nextCursor`: the block time in milliseconds and the blocked id. */
export function encodeBlockedCursor(cursor: BlockedCursor): string {
  return `${cursor.blockedAt.getTime()}${CURSOR_SEPARATOR}${cursor.id}`;
}

/** `null` for anything this module did not issue. */
export function decodeBlockedCursor(value: string): BlockedCursor | null {
  const separator = value.lastIndexOf(CURSOR_SEPARATOR);
  if (separator <= 0) return null;
  const millis = Number(value.slice(0, separator));
  const id = value.slice(separator + 1);
  if (!Number.isSafeInteger(millis) || id === "") return null;
  return { blockedAt: new Date(millis), id };
}

/**
 * The «Заблокированные» page of Story 4.5.2: the viewer's own blocks only, the
 * newest first, cut by one cursor. The adapter already answers newest first; the
 * rules re-order the rows so the page is the same no matter how the store
 * returns them, exactly like the circle lists of Story 4.3.
 */
export async function readBlockedPage(
  reader: BlockedReader,
  query: BlockedPageQuery,
): Promise<BlockedPageResult> {
  const people = await reader.readBlockedPeople(query.viewerId);
  const total = people.length;

  const rawCursor = query.cursor ?? null;
  let cursor: BlockedCursor | null = null;
  if (rawCursor !== null && rawCursor !== "") {
    cursor = decodeBlockedCursor(rawCursor);
    if (cursor === null) return INVALID_CURSOR;
  }

  const ordered = [...people].sort(compareBlockedOrder);
  const rest =
    cursor === null
      ? ordered
      : ordered.filter(function afterCursor(row) {
          return compareBlockedOrder(row, cursor) > 0;
        });
  const items = rest.slice(0, BLOCKED_PAGE_SIZE);
  const nextCursor =
    rest.length > BLOCKED_PAGE_SIZE ? encodeBlockedCursor(items[items.length - 1]) : null;

  return { ok: true, items, nextCursor, total };
}
