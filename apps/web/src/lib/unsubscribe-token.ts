import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * CLE-137 (Story 7.2, FR-36): the two reminder type switches an unsubscribe
 * letter may turn off. The channels (`datesInApp`/`datesEmail`) are untouched.
 */
export const UNSUBSCRIBE_TYPES = ["friendDates", "ownList"] as const;

export type UnsubscribeType = (typeof UNSUBSCRIBE_TYPES)[number];

/** What a valid token grants: one switch of one user, nothing else. */
export type UnsubscribePayload = { userId: string; type: UnsubscribeType };

/**
 * The purpose salt of the key (`S4-common`): the same `BETTER_AUTH_SECRET` signs
 * auth and this token, so the derived key must not be reusable for another job.
 */
const PURPOSE = "unsubscribe:v1";

/** A token holds a user id and a type; anything longer is not ours. */
const MAX_TOKEN_LENGTH = 512;

function signingKey(): Buffer {
  return createHmac("sha256", getEnv().BETTER_AUTH_SECRET).update(PURPOSE).digest();
}

function signature(payload: string): Buffer {
  return createHmac("sha256", signingKey()).update(payload).digest();
}

function isUnsubscribeType(value: unknown): value is UnsubscribeType {
  return typeof value === "string" && (UNSUBSCRIBE_TYPES as readonly string[]).includes(value);
}

/**
 * Story 7.2: a signed, versioned token of the form `base64url(payload).base64url(hmac)`.
 * It carries only the user id and the reminder type; no expiry, because the
 * letter it comes from has no expiry either. The token is a bearer capability:
 * whoever holds it may flip that one switch, and nothing else.
 */
export function createUnsubscribeToken(userId: string, type: UnsubscribeType): string {
  if (userId.length === 0) throw new Error("Empty user id");
  if (!isUnsubscribeType(type)) throw new Error("Unknown reminder type");
  const payload = Buffer.from(JSON.stringify({ u: userId, t: type })).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

/**
 * Returns the payload of a genuine token, or `null` for a forgery, a token of
 * another purpose or secret, a wrong shape and garbage. The signature is
 * compared in constant time so a wrong token teaches nothing about the secret.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, provided] = parts as [string, string];
  if (payload === "" || provided === "") return null;

  const expected = signature(payload);
  const given = Buffer.from(provided, "base64url");
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const { u, t } = parsed as { u?: unknown; t?: unknown };
    if (typeof u !== "string" || u.length === 0 || !isUnsubscribeType(t)) return null;
    return { userId: u, type: t };
  } catch {
    return null;
  }
}
