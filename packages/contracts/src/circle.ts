import { z } from "zod";
import { profileRelationshipSchema } from "./friendship";
import { USER_SEARCH_QUERY_MAX } from "./search";

/**
 * One page of every circle list (Story 4.3, AD-13). The size is part of the
 * contract, so neither client guesses it and the domain cuts the same page as
 * the API. `apps/web` imports this constant instead of keeping a second copy.
 */
export const CIRCLE_PAGE_SIZE = 15;

/**
 * One row of a circle list: only what the row shows (NFR-3). `relationship` is
 * the closed profile vocabulary of AD-7, so a list row and a profile read the
 * same set. `subscribed` is the viewer's own directed subscription to this
 * person and `followsYou` is the reverse one (AD-19); neither makes a friend.
 *
 * `id`, `nameNormalized`, email, `hideFromSearch`, wishes and the invite
 * cooldown never travel here: the internal id and the sort key are the cursor's
 * business, and the cooldown lives on the profile and in search only (Story
 * 4.3.2 decision). The object is strict, so an extra key is a contract error,
 * not a silent leak.
 */
export const circleCardSchema = z.strictObject({
  displayName: z.string(),
  nick: z.string(),
  relationship: profileRelationshipSchema,
  /** The viewer follows this person. */
  subscribed: z.boolean(),
  /** This person follows the viewer (the domain's `followsViewer`). */
  followsYou: z.boolean(),
});

export type CircleCard = z.infer<typeof circleCardSchema>;

/**
 * One page of any circle list: the rows of the page, the opaque cursor of the
 * next page (or `null` on the last one) and the full count after the filters.
 * `total` is the «N из M» denominator and never the page size.
 */
export const circlePageSchema = z.strictObject({
  items: z.array(circleCardSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().min(0),
});

export type CirclePage = z.infer<typeof circlePageSchema>;

/**
 * `GET /api/v1/me/friends`, `/me/subscriptions` and `/me/subscribers` query.
 *
 * An absent or empty `q` means the whole list, exactly like the domain: the
 * friends tab calls the endpoint before a character is typed. Only a query over
 * the global search cap or with control characters is invalid input. `cursor`
 * is the `nextCursor` of the previous page and stays opaque to the client; a
 * value the domain did not issue is `VALIDATION` with `field: "cursor"` — the
 * same `VALIDATION` pattern as the other query endpoints, no new error reason.
 */
export const circleListQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .max(USER_SEARCH_QUERY_MAX)
    .refine(function hasNoControlCharacters(value) {
      return !/[\u0000-\u001f\u007f]/.test(value);
    })
    .optional(),
  cursor: z.string().optional(),
});

export type CircleListQuery = z.infer<typeof circleListQuerySchema>;

/**
 * `GET /api/v1/me/invites` query: one optional cursor per half, so each list is
 * paged on its own. The badge count is not a page and takes no cursor.
 */
export const circleInvitesQuerySchema = z.strictObject({
  incomingCursor: z.string().optional(),
  outgoingCursor: z.string().optional(),
});

export type CircleInvitesQuery = z.infer<typeof circleInvitesQuerySchema>;

/**
 * `GET /api/v1/me/invites` data (AD-10): incoming and outgoing invites as two
 * separate pages, plus the full number of incoming invites for the «Запросы»
 * badge. `incomingCount` is not the size of the incoming page and does not
 * depend on `incomingCursor`.
 */
export const circleInvitesDataSchema = z.strictObject({
  incoming: circlePageSchema,
  outgoing: circlePageSchema,
  incomingCount: z.number().int().min(0),
});

export type CircleInvitesData = z.infer<typeof circleInvitesDataSchema>;
