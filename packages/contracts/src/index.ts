// Wire contract shared by apps/web and apps/mobile (AD-12, AD-26).
// No React, Prisma or env here: the package must load in any client.
import { z } from "zod";
import { CURRENCIES, GIFT_STATUSES, OWNER_ACTIONS, QUANTITIES, RESERVATION_LABELS, VISIBILITIES } from "./enums";
import { PROFILE_RELATIONSHIPS, profileInviteCooldownSchema } from "./friendship";

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION",
  "RATE_LIMITED",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_REASONS = [
  "EMAIL_TAKEN",
  "NICK_TAKEN",
  "DUE_OUT_OF_RANGE",
  "DATES_LIMIT",
  "RESET_LINK_STALE",
  /**
   * A rejected invite is still cooling down (Story 4.2.2, AD-10 step 3, A-16).
   * Always rides with `code: "RATE_LIMITED"` and `params: { hours }`, never with
   * the generic `RATE_LIMITED` text: the client shows "Можно снова через {hours} ч".
   */
  "INVITE_COOLDOWN",
  /**
   * The owner's own wish is archived (`archivedAt != null`), so it is read-only
   * (AD-8, FR-10 ред. 2026-11-11; CLE-82/S23.2). Always rides with
   * `code: "VALIDATION"`; the client shows the archived hint
   * «Архивное желание можно только просматривать». A foreign archived wish stays
   * `NOT_FOUND`, so this reason never reveals that somebody else's wish exists.
   */
  "GIFT_ARCHIVED",
  /**
   * The wish is `CLOSED`, which is read-only for the owner (AD-8, FR-10 ред.
   * 2026-11-11). Always rides with `code: "VALIDATION"`. The catalog sentence is
   * the same as `GIFT_ARCHIVED` on purpose (product clarification t351u,
   * CLE-82/S23.3): a closed wish and an archived one are one read-only form with
   * one caption «Архивное желание можно только просматривать».
   */
  "GIFT_CLOSED",
  /**
   * A request body exceeded the transport byte budget and was refused before
   * parsing, hashing or the database (W6). Always rides with
   * `code: "VALIDATION"` and HTTP 413; the client shows
   * `errors.reason.PAYLOAD_TOO_LARGE`.
   */
  "PAYLOAD_TOO_LARGE",
] as const;

/** Closed set of machine-readable causes; the client maps them to `errors.reason.<REASON>`. */
export const errorReasonSchema = z.enum(ERROR_REASONS);

export type ErrorReason = (typeof ERROR_REASONS)[number];

export const actionErrorSchema = z.strictObject({
  ok: z.literal(false),
  code: errorCodeSchema,
  message: z.string(),
  reason: errorReasonSchema.optional(),
  /** Form field name the error belongs to. */
  field: z.string().optional(),
  /** Interpolation values for the reason message. */
  params: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export type ActionError = z.infer<typeof actionErrorSchema>;

export type ActionResult<T> = { ok: true; data: T } | ActionError;

/** Envelope for every mutation and read result: `{ ok: true, data } | { ok: false, code, message, reason?, field?, params? }`. */
export function actionResultSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), data }),
    actionErrorSchema,
  ]);
}

/** Current user as returned by `GET /api/v1/me` and the `getMe` action. */
export const meSchema = z.strictObject({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  nick: z.string(),
  /** `null` until the client reports an IANA zone (Story 1.8). */
  timeZone: z.string().nullable(),
  /**
   * Story 3.5 (FR-8, AD-13, AD-27): the settings screen shows the switch and the
   * search hides this person from its buckets. `/u/:nick` and `/l/:token` ignore
   * the flag (AD-7).
   */
  hideFromSearch: z.boolean(),
});

export type Me = z.infer<typeof meSchema>;

export {
  CURRENCIES,
  GIFT_STATUSES,
  OWNER_ACTIONS,
  QUANTITIES,
  RESERVATION_LABELS,
  VISIBILITIES,
} from "./enums";

// Closed set: unknown keys are rejected so nothing extra (e.g. `bought`) leaks to the owner (AD-15).
export const giftCardSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  /** Integer minor units (two decimals). */
  priceAmount: z.number().int().nullable(),
  priceCurrency: z.enum(CURRENCIES).nullable(),
  linkUrl: z.string().nullable(),
  visibility: z.enum(VISIBILITIES),
  quantity: z.enum(QUANTITIES),
  expiresOn: z.string().nullable(),
  archivedAt: z.string().nullable(),
  /**
   * Card tag display order is part of the contract: unapproved custom tags
   * first by their stored text, then fixed tags by their immutable catalog
   * slug. The server sorts, and the client shows the first three and
   * collapses the rest.
   */
  tags: z.array(
    z.strictObject({
      catalogId: z.string().nullable(),
      label: z.string(),
    }),
  ),
  status: z.enum(GIFT_STATUSES),
  reservedBy: z
    .strictObject({
      id: z.string(),
      nick: z.string(),
      displayName: z.string(),
    })
    .nullable(),
  reservationLabel: z.enum(RESERVATION_LABELS).nullable(),
  ownerAction: z.enum(OWNER_ACTIONS).nullable(),
});

export type GiftCard = z.infer<typeof giftCardSchema>;

/**
 * Whose list a link or nick read describes (Story 3.3, 3.4.1): the owner's
 * public display name and nick, the heading of `/l/:publicToken` or `/u/:nick`.
 * Only those reads carry it, because only there the visitor does not already
 * know whose list they opened. A closed gate answers `not_found` without this
 * block, so a hidden list never names anybody.
 */
const listOwnerSchema = z.strictObject({
  displayName: z.string(),
  nick: z.string(),
});

/**
 * List read: gates answer `ok: true` with `access`, never NOT_FOUND; a closed gate
 * carries no gifts.
 *
 * `publicToken` is the list's immutable share token (AD-6) and is present only in
 * the owner's answer: the owner client builds `https://{domain}/l/{publicToken}`
 * from it, while another viewer never learns the shareable link. The field is
 * optional because every viewer shares this one schema: a friend, a subscriber or
 * a link visitor answers with no token. `owner` is likewise optional: a read by
 * the link token or by nick names the owner, while an `/me` read already knows
 * it. The token does not depend on the nick, so renaming never rewrites it (A-26).
 *
 * `relationship` is the viewer's closed relation to the profile owner (Story
 * 4.1.2). It is optional because the same schema serves `/l/:token` and `/me`,
 * which must never carry it; only the `/u/:nick` use-case adds the field.
 */
export const listDataSchema = z.discriminatedUnion("access", [
  z.strictObject({
    access: z.literal("gifts"),
    gifts: z.array(giftCardSchema),
    publicToken: z.string().optional(),
    owner: listOwnerSchema.optional(),
    relationship: z.enum(PROFILE_RELATIONSHIPS).optional(),
    /**
     * Story 4.2.2 (AD-10 step 3, A-16): the viewer's live rejection cooldown with
     * this profile owner. Only `/u/:nick` adds it, so `/l/:token` and `/me` keep
     * their answer unchanged. Absence means no live cooldown.
     */
    inviteCooldown: profileInviteCooldownSchema.optional(),
  }),
  z.strictObject({ access: z.literal("not_found"), gifts: z.tuple([]) }),
]);

export type ListData = z.infer<typeof listDataSchema>;

export {
  DISPLAY_NAME_MAX,
  EMAIL_MAX,
  NICK_MAX,
  NICK_MIN,
  NICK_PATTERN,
  PASSWORD_MAX,
  PASSWORD_MIN,
  hideFromSearchUpdateBodySchema,
  loginBodySchema,
  nickUpdateBodySchema,
  passwordForgotBodySchema,
  passwordResetBodySchema,
  registerBodySchema,
  safeNextPath,
  timeZoneBodySchema,
  type HideFromSearchUpdateBody,
  type LoginBody,
  type NickUpdateBody,
  type PasswordForgotBody,
  type PasswordResetBody,
  type RegisterBody,
  type TimeZoneBody,
} from "./auth";

export { rateLimitedError, rateLimitedParams } from "./rate-limit";

export {
  USER_SEARCH_LIMIT,
  USER_SEARCH_QUERY_MAX,
  userSearchCardSchema,
  userSearchDataSchema,
  userSearchQuerySchema,
  type UserSearchCard,
  type UserSearchData,
  type UserSearchQuery,
} from "./search";

export { AUTHOR_EMAIL, AUTHOR_MAILTO, PRODUCT_NAME, authorMailto } from "./brand";

export { textLength } from "./text";

export {
  FRIEND_ACCEPT_OUTCOMES,
  FRIEND_INVITE_OUTCOMES,
  FRIEND_REJECT_OUTCOMES,
  PROFILE_RELATIONSHIPS,
  friendAcceptDataSchema,
  friendAcceptOutcomeSchema,
  friendInviteDataSchema,
  friendInviteOutcomeSchema,
  friendRejectDataSchema,
  friendRejectOutcomeSchema,
  profileInviteCooldownSchema,
  profileRelationshipSchema,
  type FriendAcceptData,
  type FriendAcceptOutcome,
  type FriendInviteData,
  type FriendInviteOutcome,
  type FriendRejectData,
  type FriendRejectOutcome,
  type ProfileInviteCooldown,
  type ProfileRelationship,
} from "./friendship";

export {
  DEFAULT_QUANTITY,
  GIFT_DESCRIPTION_MAX,
  GIFT_LINK_URL_MAX,
  GIFT_PRICE_AMOUNT_MAX,
  GIFT_TAG_TEXT_MAX,
  GIFT_TITLE_MAX,
  giftInputSchema,
  giftTagInputSchema,
  giftUpdateSchema,
  giftVisibilityPreviewQuerySchema,
  giftVisibilityPreviewSchema,
  type GiftInput,
  type GiftInputDraft,
  type GiftTagInput,
  type GiftUpdate,
  type GiftVisibilityPreview,
  type GiftVisibilityPreviewQuery,
} from "./gift";

export {
  isWishVisibleToEveryone,
  type GiftVisibilityValue,
  type WishVisibleToEveryone,
} from "./visibility";

export {
  tagCatalogItemSchema,
  tagCatalogSchema,
  type TagCatalog,
  type TagCatalogItem,
} from "./tag";

export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  compareForSort,
  formatDate,
  formatPrice,
  getMessages,
  negotiateLocale,
  normalizeForSearch,
  preferredFromAcceptLanguage,
  type Messages,
  type SupportedLocale,
} from "./i18n/index";
