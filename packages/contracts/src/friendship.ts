import { z } from "zod";

/**
 * Closed success outcomes of sending a friendship invite (AD-10, AD-12,
 * Story 4.1). The wire values are the same closed set as the domain protocol in
 * `apps/web/src/domain/friendship.ts`, so a client never has to translate a
 * second vocabulary.
 *
 * A repeat pending invite and an existing friendship are successful no-ops, not
 * errors: they are `ok: true` outcomes and need no `ERROR_REASONS` entry.
 */
export const FRIEND_INVITE_OUTCOMES = [
  /** A new directed pending invite was inserted. */
  "INVITED",
  /** The sender already has a pending invite to this user; nothing was written. */
  "PENDING",
  /** The friendship already existed; nothing was written. */
  "ALREADY_FRIENDS",
  /** A reverse pending invite existed, so the pair became friends. */
  "FRIENDS_CREATED",
] as const;

export const friendInviteOutcomeSchema = z.enum(FRIEND_INVITE_OUTCOMES);

export type FriendInviteOutcome = (typeof FRIEND_INVITE_OUTCOMES)[number];

/** Success payload of `POST /api/v1/u/:nick/invite`. */
export const friendInviteDataSchema = z.strictObject({
  outcome: friendInviteOutcomeSchema,
});

export type FriendInviteData = z.infer<typeof friendInviteDataSchema>;

/**
 * The viewer's relationship to the owner of a profile, as shown by
 * `GET /api/v1/u/:nick` (AD-7, AD-10, Story 4.1.2). It is a closed set: the
 * client must never invent a stronger relation from a pending invite.
 *
 * Only the profile answer carries this field. A list read by `/l/:token` and the
 * owner's own `/me` read never do, because their relation is already fixed by
 * the route or by ownership.
 */
export const PROFILE_RELATIONSHIPS = [
  /** No friendship and no pending invite in either direction. */
  "NONE",
  /** The viewer sent an invite and the owner has not accepted it yet. */
  "OUTGOING_PENDING",
  /** The owner sent an invite and the viewer has not accepted it yet. */
  "INCOMING_PENDING",
  /** An accepted `Friendship` edge exists in either direction. */
  "FRIENDS",
] as const;

export const profileRelationshipSchema = z.enum(PROFILE_RELATIONSHIPS);

export type ProfileRelationship = (typeof PROFILE_RELATIONSHIPS)[number];
