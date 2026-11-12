import { z } from "zod";
import { DISPLAY_NAME_MAX } from "./auth";
import { profileInviteCooldownSchema, profileRelationshipSchema } from "./friendship";

/**
 * Story 3.5 / AD-13, AD-27: user search by nick (exact or prefix) and by
 * display name (fuzzy). One server-side limit for both clients, so the app and
 * the web never guess the page size. The server never loads every user: each
 * bucket asks the database for at most this many rows.
 */
export const USER_SEARCH_LIMIT = 20;

/** A query is a nick (max 24) or a display name (max 50); the larger cap applies. */
export const USER_SEARCH_QUERY_MAX = DISPLAY_NAME_MAX;

/**
 * `GET /api/v1/search?q=...` query. An absent or empty `q` is valid and answers
 * an empty list, not VALIDATION: the screen calls the endpoint before the first
 * character is typed, and FR-6 says an empty result is an empty state. Only a
 * query over the cap or with control characters is invalid input.
 */
export const userSearchQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .max(USER_SEARCH_QUERY_MAX)
    .refine(function hasNoControlCharacters(value) {
      return !/[\u0000-\u001f\u007f]/.test(value);
    })
    .default(""),
});

export type UserSearchQuery = z.infer<typeof userSearchQuerySchema>;

/**
 * A person card in the search answer: the two fields the list row shows (the
 * same shape as `listOwnerSchema`) plus the viewer's relation to this person
 * (Story 4.1.2, 4.2.2). Email, id, `hideFromSearch` and any gift fields are not
 * part of the contract (NFR-3, AD-13).
 *
 * `relationship` reuses the profile vocabulary, so the same «Добавить в друзья»
 * button reads one closed set on `/u/:nick` and in `/search`. A live rejection
 * cooldown travels in the same shape as on the profile and, while present,
 * `relationship` is `NONE`: a rejection leaves no edge and no pending invite.
 * The viewer's own card is `NONE` — `PROFILE_RELATIONSHIPS` has no `SELF`, and
 * the screen tells «это я» by comparing the nick with the session.
 *
 * `subscribed` (Story 4.6, FR-46, AD-19) is the same optional flag the profile
 * answers: `true` when the viewer has a directed `Subscription(viewerId →
 * ownerId)`, absence reads as "not subscribed". It is one fact next to the
 * relation, never a relation itself, so a subscriber is not a friend and the
 * flag rides along with no id, email or wish field (NFR-3).
 */
export const userSearchCardSchema = z.strictObject({
  displayName: z.string(),
  nick: z.string(),
  relationship: profileRelationshipSchema,
  inviteCooldown: profileInviteCooldownSchema.optional(),
  subscribed: z.boolean().optional(),
});

export type UserSearchCard = z.infer<typeof userSearchCardSchema>;

/** `GET /api/v1/search` data. `users` may be empty; that is a successful answer. */
export const userSearchDataSchema = z.strictObject({
  users: z.array(userSearchCardSchema),
});

export type UserSearchData = z.infer<typeof userSearchDataSchema>;
