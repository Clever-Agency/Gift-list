// AD-10 / ARCH-A12 — the friendship write protocol. Rules only: no Prisma, no
// React/Next.js here (AD-1). The caller hands over a `FriendshipStore`; the
// Prisma adapter in `lib/friendship-store.ts` owns the transaction.
//
// Pending is the presence of a directed `FriendshipInvite` row, never a status.
// An accepted friendship is one undirected `Friendship` edge stored as
// `userLowId < userHighId`, so the pair can only exist once. A `Block` in either
// direction forbids any write. After a rejection an `InviteCooldown` row blocks
// a new invite for 24 hours (AD-10 step 3, A-16).

/** Canonical, ascending pair of a `Friendship` edge (AD-10). */
export type FriendshipPair = {
  readonly userLowId: string;
  readonly userHighId: string;
};

/** Closed success outcomes; HTTP values are added in Story 4.1.2. */
export const FRIEND_INVITE_OUTCOMES = [
  /** A new directed pending invite was inserted. */
  "INVITED",
  /** The sender already has a pending invite to this user; nothing was written. */
  "PENDING",
  /** The friendship already exists; nothing was written. */
  "ALREADY_FRIENDS",
  /** A reverse pending invite existed, so the pair became friends in this transaction. */
  "FRIENDS_CREATED",
] as const;

export type FriendInviteOutcome = (typeof FRIEND_INVITE_OUTCOMES)[number];

/** The two refusals of the protocol; both answer `FORBIDDEN` on the wire (AD-12). */
export type FriendInviteRefusalReason = "SELF_INVITE" | "BLOCKED";

/** 24 hours of A-16: a rejected invite cannot be repeated before this window. */
export const INVITE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** The live rejection cooldown of one canonical pair, as stored. */
export type InviteCooldownRecord = {
  readonly until: Date;
  /** Sender of the rejected invite (A); only that side may be shown "rejected". */
  readonly rejectedFromUserId: string;
};

/**
 * A live cooldown refuses the send. This is a closed domain outcome, not a wire
 * payload: Story 4.2.2 maps it to `RATE_LIMITED` + `reason: INVITE_COOLDOWN` and
 * `params: { hours }`. `hours` is a whole number, at least 1 while the window
 * is open.
 */
export type FriendInviteCooldownRefusal = {
  readonly ok: false;
  readonly code: "RATE_LIMITED";
  readonly reason: "INVITE_COOLDOWN";
  readonly hours: number;
};

export type SendFriendInviteResult =
  | { readonly ok: true; readonly outcome: FriendInviteOutcome }
  | {
      readonly ok: false;
      readonly code: "FORBIDDEN";
      readonly reason: FriendInviteRefusalReason;
    }
  | FriendInviteCooldownRefusal;

/** Closed success outcomes of accepting an incoming invite (Story 4.2.1). */
export type FriendAcceptOutcome = "FRIENDS_CREATED" | "ALREADY_FRIENDS";

/**
 * Accepting is recipient-only: `fromUserId` is the inviter whose pending row is
 * accepted, `viewerId` is the authenticated recipient. A missing pending row is
 * a closed `NOT_FOUND` without a name; a Block is `FORBIDDEN` and writes
 * nothing.
 */
export type AcceptFriendInviteResult =
  | { readonly ok: true; readonly outcome: FriendAcceptOutcome }
  | { readonly ok: false; readonly code: "FORBIDDEN" | "NOT_FOUND" };

/**
 * The actor is explicit (`viewerId`, the session) so the sender cannot pass the
 * pending row's own direction and cancel their invite: the sender calling with
 * their own id is a self pair, and any other direction has no pending row.
 */
export type IncomingInvite = {
  readonly fromUserId: string;
  readonly viewerId: string;
};

/**
 * Rejecting is recipient-only as well. Success deletes exactly that pending
 * invite and writes one cooldown row; no friendship edge is created.
 */
export type RejectFriendInviteResult =
  | { readonly ok: true; readonly outcome: "REJECTED" }
  | { readonly ok: false; readonly code: "FORBIDDEN" | "NOT_FOUND" };

/**
 * The operations the protocol needs inside one transaction. The adapter answers
 * only the facts the rules ask for; it never decides the outcome itself.
 */
export interface FriendshipTransaction {
  /**
   * Serializes every protocol write of one canonical pair (AD-10).
   *
   * The directed UNIQUE on `FriendshipInvite(fromUserId, toUserId)` does not
   * stop A→B and B→A from inserting at the same time: both may read "no
   * reverse pending" before either commits and leave two mutual pendings. The
   * adapter therefore takes a transaction-scoped lock on the canonical pair as
   * the first statement of the transaction. Both directions use the same key,
   * so the second send waits, then sees the first committed invite and
   * auto-accepts it (AD-10 step 2, ARCH-A12). Accept, reject and send all take
   * this one lock before reading the pair; there is no second lock design.
   */
  lockPair(pair: FriendshipPair): Promise<void>;
  /** A `Block` row between the two users in either direction (AD-10 step 4). */
  hasBlockBetween(firstUserId: string, secondUserId: string): Promise<boolean>;
  /** Whether the canonical pair already has an accepted edge. */
  findFriendship(pair: FriendshipPair): Promise<boolean>;
  /** Whether `fromUserId` already has a pending invite to `toUserId`. */
  findPendingInvite(fromUserId: string, toUserId: string): Promise<boolean>;
  createInvite(fromUserId: string, toUserId: string): Promise<void>;
  /** Removes exactly one directed invite (recipient rejection). */
  deleteInvite(fromUserId: string, toUserId: string): Promise<void>;
  /** Inserts the single edge of the pair; the UNIQUE index is the last guard. */
  createFriendship(pair: FriendshipPair): Promise<void>;
  /** Removes every invite between the two users, in both directions (AD-10 step 2). */
  deleteInvitesBetween(firstUserId: string, secondUserId: string): Promise<void>;
  /** The pair's rejection cooldown row, or `null` when none was ever written. */
  findInviteCooldown(pair: FriendshipPair): Promise<InviteCooldownRecord | null>;
  /** Upserts one row per pair; a repeated rejection refreshes `until`. */
  createInviteCooldown(
    pair: FriendshipPair,
    rejectedFromUserId: string,
    until: Date,
  ): Promise<void>;
  deleteInviteCooldown(pair: FriendshipPair): Promise<void>;
}

/** Transactional boundary around the protocol (Prisma `$transaction` behind it). */
export interface FriendshipStore {
  transaction<T>(work: (tx: FriendshipTransaction) => Promise<T>): Promise<T>;
}

/**
 * Order two user ids into the canonical `Friendship` pair. Ids are CUID2, so a
 * plain string comparison is stable; the migration CHECK repeats the rule.
 */
export function orderFriendPair(firstUserId: string, secondUserId: string): FriendshipPair {
  return firstUserId < secondUserId
    ? { userLowId: firstUserId, userHighId: secondUserId }
    : { userLowId: secondUserId, userHighId: firstUserId };
}

function forbidden(reason: FriendInviteRefusalReason): SendFriendInviteResult {
  return { ok: false, code: "FORBIDDEN", reason };
}

const NOT_FOUND_RESULT = { ok: false, code: "NOT_FOUND" } as const;
const FORBIDDEN_RESULT = { ok: false, code: "FORBIDDEN" } as const;

/** Whole hours left until `until`, never below 1 while the window is open. */
function hoursUntil(until: Date, now: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 3_600_000));
}

/**
 * The single accept primitive (AD-10 step 2, Story 4.2.1): one canonical
 * `Friendship` edge, every invite of the pair deleted, and the pair's rejection
 * cooldown cleared. Both the reverse-pending auto-accept in `sendFriendInvite`
 * and an explicit `acceptFriendInvite` call this function, so there is exactly
 * one accept protocol and no second insert.
 */
async function acceptFriendPair(
  tx: FriendshipTransaction,
  pair: FriendshipPair,
  firstUserId: string,
  secondUserId: string,
): Promise<void> {
  await tx.createFriendship(pair);
  await tx.deleteInvitesBetween(firstUserId, secondUserId);
  await tx.deleteInviteCooldown(pair);
}

/**
 * Send a friendship invite from an already authenticated viewer to a resolved
 * target user (AD-10, ARCH-A12, Story 4.1; cooldown in Story 4.2.1).
 *
 * All checks and writes happen in one transaction:
 *
 * 0. a transaction-scoped lock on the canonical pair serializes both send
 *    directions, so two concurrent invites cannot both miss the other one;
 * 1. sending to yourself is refused before the database is touched;
 * 2. a block in either direction refuses the write;
 * 3. an existing friendship is a no-op (`ALREADY_FRIENDS`);
 * 4. the sender's own pending invite is returned unchanged, never duplicated;
 * 5. a live rejection cooldown refuses the send (`RATE_LIMITED` /
 *    `INVITE_COOLDOWN` + hours); an expired row is deleted in this transaction;
 * 6. a reverse pending invite auto-accepts the pair through the shared accept
 *    primitive: one ordered edge, all pair invites deleted, cooldown cleared
 *    (`FRIENDS_CREATED`);
 * 7. otherwise exactly one directed invite is inserted (`INVITED`).
 *
 * The function never reads a wishlist and never fakes a subscriber; visibility
 * stays with `VisibilityPolicy` (AD-7).
 */
export async function sendFriendInvite(
  input: { readonly fromUserId: string; readonly toUserId: string },
  store: FriendshipStore,
): Promise<SendFriendInviteResult> {
  const { fromUserId, toUserId } = input;
  if (fromUserId === toUserId) return forbidden("SELF_INVITE");

  return store.transaction(async function runInviteProtocol(tx) {
    const pair = orderFriendPair(fromUserId, toUserId);

    // Take the pair lock before reading any state: a concurrent send in the
    // opposite direction must wait, so this transaction never decides on a
    // snapshot taken before the other invite committed. Every statement after
    // the lock sees the latest committed rows on READ COMMITTED.
    await tx.lockPair(pair);

    if (await tx.hasBlockBetween(fromUserId, toUserId)) return forbidden("BLOCKED");

    if (await tx.findFriendship(pair)) return { ok: true, outcome: "ALREADY_FRIENDS" };

    if (await tx.findPendingInvite(fromUserId, toUserId)) {
      return { ok: true, outcome: "PENDING" };
    }

    // A rejection left a 24-hour gate on the pair (A-16). Only `until > now`
    // is live; an expired row is removed by this successful send, so no cron
    // is needed. The gate is read before the reverse-pending auto-accept too:
    // while the pair is cooling down no send may produce an edge, even if a
    // legacy/inconsistent reverse row exists. Block still wins above and never
    // touches the cooldown row.
    const cooldown = await tx.findInviteCooldown(pair);
    if (cooldown !== null) {
      const now = new Date();
      if (cooldown.until.getTime() > now.getTime()) {
        return {
          ok: false,
          code: "RATE_LIMITED",
          reason: "INVITE_COOLDOWN",
          hours: hoursUntil(cooldown.until, now),
        };
      }
      await tx.deleteInviteCooldown(pair);
    }

    // A reverse invite means both people asked; accept the pair right away
    // through the same primitive an explicit acceptance uses (Story 4.2.1).
    if (await tx.findPendingInvite(toUserId, fromUserId)) {
      await acceptFriendPair(tx, pair, fromUserId, toUserId);
      return { ok: true, outcome: "FRIENDS_CREATED" };
    }

    await tx.createInvite(fromUserId, toUserId);
    return { ok: true, outcome: "INVITED" };
  });
}

/**
 * Explicit acceptance of an incoming invite (Story 4.2.1, AD-10 step 2).
 *
 * `fromUserId` is the inviter and `viewerId` is the authenticated recipient;
 * only a pending row in exactly this direction is accepted, so the sender
 * cannot accept on the recipient's behalf and a missing pending row is a closed
 * `NOT_FOUND`. A Block in either direction is `FORBIDDEN` and writes nothing.
 * Success uses the same `acceptFriendPair` primitive as the reverse-pending
 * auto-accept: one ordered edge, all pair invites deleted, the pair's cooldown
 * cleared. An already-friends call inserts no second edge but still clears a
 * stale pair invite/cooldown, so the cooldown invariant holds for every accept.
 */
export async function acceptFriendInvite(
  input: IncomingInvite,
  store: FriendshipStore,
): Promise<AcceptFriendInviteResult> {
  const { fromUserId, viewerId } = input;
  if (fromUserId === viewerId) return NOT_FOUND_RESULT;

  return store.transaction(async function runAcceptProtocol(tx) {
    const pair = orderFriendPair(fromUserId, viewerId);
    await tx.lockPair(pair);

    if (await tx.hasBlockBetween(fromUserId, viewerId)) return FORBIDDEN_RESULT;
    if (await tx.findFriendship(pair)) {
      await tx.deleteInvitesBetween(fromUserId, viewerId);
      await tx.deleteInviteCooldown(pair);
      return { ok: true, outcome: "ALREADY_FRIENDS" };
    }
    if (!(await tx.findPendingInvite(fromUserId, viewerId))) return NOT_FOUND_RESULT;

    await acceptFriendPair(tx, pair, fromUserId, viewerId);
    return { ok: true, outcome: "FRIENDS_CREATED" };
  });
}

/**
 * Recipient-only rejection of an incoming invite (Story 4.2.1, AD-10 step 3,
 * A-16). `viewerId` is the authenticated actor and must be the recipient of the
 * pending row; the sender has no valid direction to call, so a sender-side
 * cancel is impossible here (that is Story 4.3).
 *
 * Success deletes exactly that invite and writes one `InviteCooldown` row for
 * the canonical pair with `until = now + 24h` UTC and `rejectedFromUserId` set
 * to the inviter. No `Friendship` edge is created. A Block is `FORBIDDEN` and
 * writes no cooldown row.
 */
export async function rejectFriendInvite(
  input: IncomingInvite,
  store: FriendshipStore,
): Promise<RejectFriendInviteResult> {
  const { fromUserId, viewerId } = input;
  if (fromUserId === viewerId) return NOT_FOUND_RESULT;

  return store.transaction(async function runRejectProtocol(tx) {
    const pair = orderFriendPair(fromUserId, viewerId);
    await tx.lockPair(pair);

    if (await tx.hasBlockBetween(fromUserId, viewerId)) return FORBIDDEN_RESULT;
    if (!(await tx.findPendingInvite(fromUserId, viewerId))) return NOT_FOUND_RESULT;

    await tx.deleteInvite(fromUserId, viewerId);
    await tx.createInviteCooldown(pair, fromUserId, new Date(Date.now() + INVITE_COOLDOWN_MS));
    return { ok: true, outcome: "REJECTED" };
  });
}
