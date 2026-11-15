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
 * The actor of a cancel is the sender of a pending invite (`viewerId`), and
 * `toUserId` is the recipient. The recipient of that invite has no outgoing
 * pending row of their own, so calling cancel with the direction reversed is a
 * closed `NOT_FOUND` and never deletes the other person's invite.
 */
export type OutgoingInvite = {
  readonly toUserId: string;
  readonly viewerId: string;
};

/**
 * Closed success outcomes of cancelling one's own pending invite (Story 4.3).
 * `CANCELLED` deleted the invite and wrote the pair cooldown; `ALREADY_FRIENDS`
 * is the no-op of an anomalous pending row next to a live friendship and writes
 * nothing — no second edge, no cooldown.
 */
export const FRIEND_CANCEL_OUTCOMES = ["CANCELLED", "ALREADY_FRIENDS"] as const;

export type FriendCancelOutcome = (typeof FRIEND_CANCEL_OUTCOMES)[number];

export type CancelFriendInviteResult =
  | { readonly ok: true; readonly outcome: FriendCancelOutcome }
  | { readonly ok: false; readonly code: "FORBIDDEN" | "NOT_FOUND" };

/**
 * Closed success outcomes of removing an accepted friend (Story 4.4, AD-10
 * step 4). `REMOVED` deleted the edge and every invite of the pair;
 * `ALREADY_REMOVED` is the idempotent answer of a pair without an edge and
 * still deletes dangling pair invites, so the acceptance criterion holds even
 * when two removals race.
 */
export const FRIEND_REMOVE_OUTCOMES = ["REMOVED", "ALREADY_REMOVED"] as const;

export type FriendRemoveOutcome = (typeof FRIEND_REMOVE_OUTCOMES)[number];

/**
 * Removing has no direction: either side of the accepted edge may act, and the
 * refusal is the same `FORBIDDEN` as a blocked cancel. A self pair is refused
 * as `FORBIDDEN` before the store is touched; there is no `NOT_FOUND` in this
 * closed answer because the domain only receives an already resolved user id
 * (the action resolves the nick in Story 4.4.2).
 */
export type RemoveFriendResult =
  | { readonly ok: true; readonly outcome: FriendRemoveOutcome }
  | { readonly ok: false; readonly code: "FORBIDDEN" };

/**
 * The actor of a removal (`viewerId`, the session) and the other side of the
 * edge. The `Friendship` row itself is undirected, so the direction of the call
 * never matters.
 */
export type FriendRemoval = {
  readonly otherUserId: string;
  readonly viewerId: string;
};

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
  /** Removes the single edge of the pair (unfriend, AD-10 step 4). */
  deleteFriendship(pair: FriendshipPair): Promise<void>;
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
export function inviteCooldownHoursLeft(until: Date, now: Date = new Date()): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 3_600_000));
}

/**
 * Whole hours left while the rejection window is live, or `null` once `until`
 * has passed. `sendFriendInvite` and the profile DTO of Story 4.2.2 share this
 * one calculation, so the wire never disagrees with the write gate.
 */
export function liveInviteCooldownHours(
  record: InviteCooldownRecord,
  now: Date = new Date(),
): number | null {
  return record.until.getTime() > now.getTime()
    ? inviteCooldownHoursLeft(record.until, now)
    : null;
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
      const hours = liveInviteCooldownHours(cooldown, now);
      if (hours !== null) {
        return {
          ok: false,
          code: "RATE_LIMITED",
          reason: "INVITE_COOLDOWN",
          hours,
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
 * pending row; the sender has no valid direction to call, so a sender cancels
 * through {@link cancelFriendInvite} instead (Story 4.3).
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

/**
 * The sender withdraws their own pending invite (Story 4.3, AD-10 step 3): the
 * mirror of {@link rejectFriendInvite} in the other direction.
 *
 * `viewerId` is the authenticated actor and must be the sender of the pending
 * row `viewerId → toUserId`; the recipient calling cancel has no outgoing
 * pending row, so the answer is a closed `NOT_FOUND` and the inviter's row
 * survives. A self pair is answered before the store is touched. A missing
 * pending row is `NOT_FOUND` in every state, even when the pair is already
 * friends. A `Block` in either direction is `FORBIDDEN` and writes nothing at
 * all.
 *
 * Success deletes exactly that directed invite and writes one `InviteCooldown`
 * row for the canonical pair with `until = now + 24h` UTC and
 * `rejectedFromUserId` set to the cancelling sender, so a repeat invite in the
 * window is refused by `sendFriendInvite` with `RATE_LIMITED` /
 * `INVITE_COOLDOWN`. No `Friendship` edge is created.
 *
 * A pending row next to a live friendship is an anomaly: the protocol never
 * produces it (accept deletes every pair invite and the pair cooldown). It is
 * the closed no-op `ALREADY_FRIENDS` and writes nothing — no second edge and no
 * cooldown — so a second accept cannot be faked through cancel.
 *
 * Storage note for Story 4.3.2/4.3.3: `InviteCooldown` has no column that says
 * who ended the invite, so a cancelled and a rejected window look identical
 * (`rejectedFromUserId` is the inviter's id in both). The domain cannot tell
 * them apart without a migration; the UI must not show «отклонено» after a
 * self-cancel (see `FRIEND_CANCEL_OUTCOMES`).
 */
export async function cancelFriendInvite(
  input: OutgoingInvite,
  store: FriendshipStore,
): Promise<CancelFriendInviteResult> {
  const { toUserId, viewerId } = input;
  if (viewerId === toUserId) return NOT_FOUND_RESULT;

  return store.transaction(async function runCancelProtocol(tx) {
    const pair = orderFriendPair(viewerId, toUserId);
    await tx.lockPair(pair);

    if (await tx.hasBlockBetween(viewerId, toUserId)) return FORBIDDEN_RESULT;
    if (!(await tx.findPendingInvite(viewerId, toUserId))) return NOT_FOUND_RESULT;
    if (await tx.findFriendship(pair)) return { ok: true, outcome: "ALREADY_FRIENDS" };

    await tx.deleteInvite(viewerId, toUserId);
    await tx.createInviteCooldown(pair, viewerId, new Date(Date.now() + INVITE_COOLDOWN_MS));
    return { ok: true, outcome: "CANCELLED" };
  });
}

/**
 * Either side of an accepted friendship removes it (Story 4.4, FR-23, AD-10
 * step 4). This is the only unfriend primitive: it deletes the pair's
 * `Friendship` edge and every invite of the pair, and nothing else.
 *
 * Order inside the one transaction:
 *
 * 0. the transaction-scoped pair lock comes first, exactly as in send, accept,
 *    reject and cancel, so a removal cannot interleave with an invite or an
 *    acceptance of the same pair;
 * 1. a self pair is refused before the store is touched;
 * 2. a `Block` in either direction is `FORBIDDEN` and deletes nothing — the
 *    block protocol (Story 4.5) owns the edge in that state;
 * 3. a missing edge is the idempotent `ALREADY_REMOVED`; the pair invites are
 *    still deleted, so a stale invite cannot survive a repeated removal;
 * 4. otherwise the edge and both directed invites are deleted (`REMOVED`).
 *
 * Subscriptions stay untouched in both directions (their removal belongs to
 * Story 4.5, not to unfriend), the pair is not blocked, and no `InviteCooldown`
 * is written: the two people may invite each other again immediately, and a new
 * friendship appears only through a newly accepted invite. Wishlist visibility
 * is not touched here at all — `VisibilityPolicy` reads the edge and stops
 * opening `FRIENDS` wishes as soon as the row is gone (AD-7).
 */
export async function removeFriend(
  input: FriendRemoval,
  store: FriendshipStore,
): Promise<RemoveFriendResult> {
  const { otherUserId, viewerId } = input;
  if (viewerId === otherUserId) return FORBIDDEN_RESULT;

  return store.transaction(async function runRemoveProtocol(tx) {
    const pair = orderFriendPair(viewerId, otherUserId);
    await tx.lockPair(pair);

    if (await tx.hasBlockBetween(viewerId, otherUserId)) return FORBIDDEN_RESULT;

    const hadFriendship = await tx.findFriendship(pair);
    if (hadFriendship) await tx.deleteFriendship(pair);
    // Both directions: a pending row next to a live edge is an anomaly the
    // protocol never produces, and the AC says the pair's invites go with it.
    await tx.deleteInvitesBetween(viewerId, otherUserId);

    return { ok: true, outcome: hadFriendship ? "REMOVED" : "ALREADY_REMOVED" };
  });
}
