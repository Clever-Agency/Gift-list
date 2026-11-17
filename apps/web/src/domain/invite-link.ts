// AD-21 / FR-47 — the invite link protocol. Rules only: no Prisma, no
// React/Next.js here (AD-1). The caller hands over an `InviteLinkStore`; the
// Prisma adapter in `lib/invite-link-store.ts` owns the transaction.
//
// One immutable token per user (`InviteLink.userId` is the primary key) is
// opened as `/i/:token`. Registration with the token creates the `Friendship` in
// the same transaction as the account (see `actions/register.ts`); an already
// registered viewer sees a confirmation and the edge appears only after the
// explicit accept. A link preview by a messenger reads only: `readInviteLinkState`
// never writes, so a prefetch cannot create a relationship (AD-21).
//
// The accept is the inverse of a manual invite: no `FriendshipInvite` and no
// `InviteCooldown` row is written or read. A `Block` in either direction and an
// unknown token are the same closed `NOT_FOUND`, so the link never reveals that
// the owner blocked the viewer; the owner's own token is `FORBIDDEN`.

import { orderFriendPair, type FriendshipPair } from "@/domain/friendship";

/**
 * The owner of a live token: the user id the pair is built from and the two
 * public fields the confirmation and the preview show. Email, wishes and the
 * account itself never load here (AD-12).
 */
export type InviteLinkOwner = {
  readonly id: string;
  readonly displayName: string;
  readonly nick: string;
};

/**
 * Closed preview states of `/i/:token` (Story 4.7.1). `self` is the viewer's own
 * link, `friends` an existing edge, `can_accept` the confirmation of
 * «Добавить {имя} в друзья?», and `not_found` both an unknown token and a
 * `Block` in either direction — the two are deliberately indistinguishable.
 */
export const INVITE_LINK_STATES = ["self", "friends", "can_accept", "not_found"] as const;

export type InviteLinkState = (typeof INVITE_LINK_STATES)[number];

/** States that name the owner; `not_found` never carries a name or an id. */
type KnownInviteLinkState = Exclude<InviteLinkState, "not_found">;

export type InviteLinkPreview =
  | { readonly state: KnownInviteLinkState; readonly owner: InviteLinkOwner }
  | { readonly state: "not_found" };

/**
 * Closed success outcomes of accepting a link. `FRIENDS` inserted the single
 * pair edge and deleted every pending invite of the pair; `ALREADY_FRIENDS`
 * wrote nothing at all.
 */
export const INVITE_LINK_ACCEPT_OUTCOMES = ["FRIENDS", "ALREADY_FRIENDS"] as const;

export type InviteLinkAcceptOutcome = (typeof INVITE_LINK_ACCEPT_OUTCOMES)[number];

/**
 * The link's own refusals. Self is `FORBIDDEN` (Story 4.7.2 answers 403); an
 * unknown token and a `Block` in either direction are the same `NOT_FOUND`, so
 * the wire cannot tell them apart.
 */
export type AcceptInviteLinkResult =
  | {
      readonly ok: true;
      readonly outcome: InviteLinkAcceptOutcome;
      readonly owner: InviteLinkOwner;
    }
  | { readonly ok: false; readonly code: "FORBIDDEN" | "NOT_FOUND" };

/**
 * The reads the protocol needs. The adapter answers only the facts the rules ask
 * for; it never decides the state itself, and none of these calls writes.
 */
export interface InviteLinkReader {
  /** The owner of the token, or `null` when no user holds it. */
  findOwnerByToken(token: string): Promise<InviteLinkOwner | null>;
  /** A `Block` row between the two users in either direction (AD-10 step 4). */
  hasBlockBetween(firstUserId: string, secondUserId: string): Promise<boolean>;
  /** Whether the canonical pair already has an accepted edge. */
  findFriendship(pair: FriendshipPair): Promise<boolean>;
}

/**
 * What the accept needs inside one transaction. The pair lock comes first,
 * exactly as in every other write of the pair (AD-10, ARCH-A12), so two
 * simultaneous accepts cannot both report a new edge.
 */
export interface InviteLinkTransaction extends InviteLinkReader {
  lockPair(pair: FriendshipPair): Promise<void>;
  /** Inserts the single edge of the pair; the UNIQUE index is the last guard. */
  createFriendship(pair: FriendshipPair): Promise<void>;
  /** Removes every invite between the two users, in both directions (AD-10 step 2). */
  deleteInvitesBetween(firstUserId: string, secondUserId: string): Promise<void>;
}

/**
 * Transactional boundary around the accept plus the read-only preview. The same
 * adapter answers both, so the preview and the write share one token lookup.
 */
export interface InviteLinkStore extends InviteLinkReader {
  transaction<T>(work: (tx: InviteLinkTransaction) => Promise<T>): Promise<T>;
}

/** The actor (the session). A preview never needs more than the two values. */
export type InviteLinkPreviewQuery = {
  readonly viewerId: string;
  readonly token: string;
};

/** Accepting resolves the owner from the token inside the transaction. */
export type InviteLinkAcceptance = {
  readonly viewerId: string;
  readonly token: string;
};

/**
 * The primitive registration calls: the caller already resolved the token in the
 * registration transaction (AD-21), so the owner arrives as a row, not a token.
 */
export type InviteLinkAcceptanceInTransaction = {
  readonly viewerId: string;
  readonly owner: InviteLinkOwner;
};

const NOT_FOUND_RESULT = { ok: false, code: "NOT_FOUND" } as const;
const FORBIDDEN_RESULT = { ok: false, code: "FORBIDDEN" } as const;

/**
 * What `/i/:token` shows to an authenticated viewer (Story 4.7.1): `self`,
 * `friends`, `can_accept` or `not_found`. Read-only by construction — the reader
 * has no write method, so a messenger preview or a page load writes nothing.
 *
 * Order: the token is resolved first, then the viewer's own link (a `Block` with
 * oneself cannot exist), then the block gate and the edge. A blocked pair and an
 * unknown token answer the same `not_found` without the owner block, so the
 * preview never names somebody who blocked the viewer.
 */
export async function readInviteLinkState(
  reader: InviteLinkReader,
  query: InviteLinkPreviewQuery,
): Promise<InviteLinkPreview> {
  const owner = await reader.findOwnerByToken(query.token);
  if (owner === null) return { state: "not_found" };
  if (query.viewerId === owner.id) return { state: "self", owner };
  if (await reader.hasBlockBetween(query.viewerId, owner.id)) return { state: "not_found" };
  if (await reader.findFriendship(orderFriendPair(query.viewerId, owner.id))) {
    return { state: "friends", owner };
  }
  return { state: "can_accept", owner };
}

/**
 * Accept a link token by an already authenticated viewer (Story 4.7.1). The
 * owner is resolved in the same transaction as the write, so a token deleted or
 * reissued while the request runs cannot produce an edge to a stale owner.
 *
 * Unknown token and a `Block` in either direction are the same closed
 * `NOT_FOUND`; the owner's own token is `FORBIDDEN` before the pair lock is
 * taken. Nothing is written on any refusal.
 */
export async function acceptInviteLink(
  input: InviteLinkAcceptance,
  store: InviteLinkStore,
): Promise<AcceptInviteLinkResult> {
  return store.transaction(async function runAcceptInviteLink(tx) {
    const owner = await tx.findOwnerByToken(input.token);
    if (owner === null) return NOT_FOUND_RESULT;
    return acceptInviteLinkInTransaction({ viewerId: input.viewerId, owner }, tx);
  });
}

/**
 * The accept primitive of one already resolved owner (Story 4.7.1). Both
 * `acceptInviteLink` and registration call it, so a link creates the edge in
 * exactly one way.
 *
 * Order inside the one transaction: self is refused before the lock, then the
 * pair lock serializes with every other write of the pair, then the block gate
 * (`NOT_FOUND`, never a separate code), then the existing edge
 * (`ALREADY_FRIENDS`, no write at all — not even the stale pair invites), and
 * finally one ordered `Friendship` edge plus the deletion of every pending invite
 * of the pair (`FRIENDS`). `InviteCooldown` is neither read nor written: an
 * invite link has no confirmation and no rejection gate.
 */
export async function acceptInviteLinkInTransaction(
  input: InviteLinkAcceptanceInTransaction,
  tx: InviteLinkTransaction,
): Promise<AcceptInviteLinkResult> {
  const { viewerId, owner } = input;
  if (viewerId === owner.id) return FORBIDDEN_RESULT;

  const pair = orderFriendPair(viewerId, owner.id);
  await tx.lockPair(pair);

  if (await tx.hasBlockBetween(viewerId, owner.id)) return NOT_FOUND_RESULT;

  if (await tx.findFriendship(pair)) {
    return { ok: true, outcome: "ALREADY_FRIENDS", owner };
  }

  await tx.createFriendship(pair);
  await tx.deleteInvitesBetween(viewerId, owner.id);
  return { ok: true, outcome: "FRIENDS", owner };
}
