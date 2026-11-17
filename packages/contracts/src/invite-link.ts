import { z } from "zod";

/**
 * Closed preview states of `/i/:token` for a signed-in viewer (Story 4.7, AD-21).
 * The values are the domain protocol's own vocabulary (`apps/web/src/domain/invite-link.ts`),
 * so a client never translates a second one: `self` is the viewer's own link,
 * `friends` an existing edge, `can_accept` the confirmation
 * «Добавить {имя} в друзья?».
 *
 * An anonymous preview carries no `state` at all: the three values are facts
 * about the viewer, and a guest has none of them.
 */
export const INVITE_LINK_STATES = ["self", "friends", "can_accept"] as const;

export const inviteLinkStateSchema = z.enum(INVITE_LINK_STATES);

export type InviteLinkState = (typeof INVITE_LINK_STATES)[number];

/**
 * Who invites, as the preview names them. The same two public fields as the
 * `/l` owner block: no id, email, avatar or wish field rides along, and a guest
 * gets exactly what a list link already shows.
 */
export const inviteLinkInviterSchema = z.strictObject({
  displayName: z.string(),
  nick: z.string(),
});

export type InviteLinkInviter = z.infer<typeof inviteLinkInviterSchema>;

/**
 * `GET /api/v1/i/:token`: the inviter and, for a signed-in viewer, their closed
 * relation to the link. An unknown token and a `Block` in either direction are
 * not a preview at all — the route answers the same `NOT_FOUND` envelope, so the
 * wire can never tell the two apart and never names somebody who blocked the
 * viewer.
 */
export const inviteLinkPreviewSchema = z.strictObject({
  inviter: inviteLinkInviterSchema,
  state: inviteLinkStateSchema.optional(),
});

export type InviteLinkPreview = z.infer<typeof inviteLinkPreviewSchema>;

/**
 * `GET /api/v1/me/invite-link`: the viewer's own immutable token (AD-21). The
 * link itself is built by the client as `{origin}/i/{token}`, exactly as the
 * `publicToken` of a list becomes `{origin}/l/{publicToken}` (Story 2.4), so no
 * domain or scheme is fixed on the wire.
 */
export const inviteLinkDataSchema = z.strictObject({
  token: z.string(),
});

export type InviteLinkData = z.infer<typeof inviteLinkDataSchema>;

/**
 * Closed success outcomes of accepting a link (Story 4.7, AD-21). `FRIENDS`
 * inserted the single pair edge, `ALREADY_FRIENDS` is the idempotent answer of a
 * pair that is already friends (nothing was written).
 *
 * Both are successful answers, never errors: an unknown token, a `Block` and the
 * viewer's own link are the refusals, and they never share this vocabulary.
 */
export const INVITE_LINK_ACCEPT_OUTCOMES = ["FRIENDS", "ALREADY_FRIENDS"] as const;

export const inviteLinkAcceptOutcomeSchema = z.enum(INVITE_LINK_ACCEPT_OUTCOMES);

export type InviteLinkAcceptOutcome = (typeof INVITE_LINK_ACCEPT_OUTCOMES)[number];

/** Success payload of `POST /api/v1/i/:token/accept`. */
export const inviteLinkAcceptDataSchema = z.strictObject({
  outcome: inviteLinkAcceptOutcomeSchema,
});

export type InviteLinkAcceptData = z.infer<typeof inviteLinkAcceptDataSchema>;
