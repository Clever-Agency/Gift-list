// Wire contract shared by apps/web and apps/mobile (AD-12, AD-26).
// No React, Prisma or env here: the package must load in any client.
import { z } from "zod";

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

export const actionErrorSchema = z.strictObject({
  ok: z.literal(false),
  code: errorCodeSchema,
  message: z.string(),
  /** Field-level messages for VALIDATION, keyed by form field name. */
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

export type ActionError = z.infer<typeof actionErrorSchema>;

export type ActionResult<T> = { ok: true; data: T } | ActionError;

/** Envelope for every mutation and read result: `{ ok: true, data } | { ok: false, code, message }`. */
export function actionResultSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), data }),
    actionErrorSchema,
  ]);
}

export const CURRENCIES = ["USD", "EUR", "CNY", "BYN", "RUB"] as const;
export const VISIBILITIES = ["PUBLIC", "FRIENDS", "SECRET"] as const;
export const QUANTITIES = ["SINGLE", "UNLIMITED"] as const;
export const GIFT_STATUSES = ["OPEN", "RESERVED", "CLOSED"] as const;
export const RESERVATION_LABELS = ["BOUGHT", "GIVEN"] as const;
export const OWNER_ACTIONS = ["CONFIRM_GIVEN", "EXPIRED_NO_REPLY"] as const;

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

/** List read: gates answer `ok: true` with `access`, never NOT_FOUND; a closed gate carries no gifts. */
export const listDataSchema = z.discriminatedUnion("access", [
  z.strictObject({ access: z.literal("gifts"), gifts: z.array(giftCardSchema) }),
  z.strictObject({ access: z.literal("not_found"), gifts: z.tuple([]) }),
]);

export type ListData = z.infer<typeof listDataSchema>;

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
