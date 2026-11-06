// AD-10 / ARCH-A12 — the friendship write protocol. Rules only: no Prisma, no
// React/Next.js here (AD-1). The caller hands over a `FriendshipStore`; the
// Prisma adapter in `lib/friendship-store.ts` owns the transaction.
//
// Pending is the presence of a directed `FriendshipInvite` row, never a status.
// An accepted friendship is one undirected `Friendship` edge stored as
// `userLowId < userHighId`, so the pair can only exist once. A `Block` in either
// direction forbids any write.

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

export type SendFriendInviteResult =
  | { readonly ok: true; readonly outcome: FriendInviteOutcome }
  | {
      readonly ok: false;
      readonly code: "FORBIDDEN";
      readonly reason: FriendInviteRefusalReason;
    };

/**
 * The operations the protocol needs inside one transaction. The adapter answers
 * only the facts the rules ask for; it never decides the outcome itself.
 */
export interface FriendshipTransaction {
  /** A `Block` row between the two users in either direction (AD-10 step 4). */
  hasBlockBetween(firstUserId: string, secondUserId: string): Promise<boolean>;
  /** Whether the canonical pair already has an accepted edge. */
  findFriendship(pair: FriendshipPair): Promise<boolean>;
  /** Whether `fromUserId` already has a pending invite to `toUserId`. */
  findPendingInvite(fromUserId: string, toUserId: string): Promise<boolean>;
  createInvite(fromUserId: string, toUserId: string): Promise<void>;
  /** Inserts the single edge of the pair; the UNIQUE index is the last guard. */
  createFriendship(pair: FriendshipPair): Promise<void>;
  /** Removes every invite between the two users, in both directions (AD-10 step 2). */
  deleteInvitesBetween(firstUserId: string, secondUserId: string): Promise<void>;
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

/**
 * Send a friendship invite from an already authenticated viewer to a resolved
 * target user (AD-10, ARCH-A12, Story 4.1).
 *
 * All checks and writes happen in one transaction:
 *
 * 1. sending to yourself is refused before the database is touched;
 * 2. a block in either direction refuses the write;
 * 3. an existing friendship is a no-op (`ALREADY_FRIENDS`);
 * 4. the sender's own pending invite is returned unchanged, never duplicated;
 * 5. a reverse pending invite auto-accepts the pair: one ordered edge, all pair
 *    invites deleted (`FRIENDS_CREATED`);
 * 6. otherwise exactly one directed invite is inserted (`INVITED`).
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
    if (await tx.hasBlockBetween(fromUserId, toUserId)) return forbidden("BLOCKED");

    const pair = orderFriendPair(fromUserId, toUserId);
    if (await tx.findFriendship(pair)) return { ok: true, outcome: "ALREADY_FRIENDS" };

    if (await tx.findPendingInvite(fromUserId, toUserId)) {
      return { ok: true, outcome: "PENDING" };
    }

    // A reverse invite means both people asked; accept the pair right away,
    // exactly as Story 4.2 will accept a single invite.
    if (await tx.findPendingInvite(toUserId, fromUserId)) {
      await tx.createFriendship(pair);
      await tx.deleteInvitesBetween(fromUserId, toUserId);
      return { ok: true, outcome: "FRIENDS_CREATED" };
    }

    await tx.createInvite(fromUserId, toUserId);
    return { ok: true, outcome: "INVITED" };
  });
}
