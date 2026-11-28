import {
  accountDeletedSchema,
  emailChangeAcceptedSchema,
  emailChangeCancelledSchema,
  meSchema,
  myProfileSchema,
  type Me,
  type MyProfile,
  type ProfileUpdateBody,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";
import { clearSessionToken } from "@/platform/session-token";
import { forgetAuthEmail } from "@/session/auth-navigation";

/**
 * Story 3.1: the nick change answers with the current user, so the settings
 * screen can put it into `AuthContext` without a reload. The payload is
 * re-checked with the shared contract (AD-12) like the gift clients: a body
 * that does not match is `invalid`, not a broken connection.
 */
export type MeResult =
  | { ok: true; data: Me }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 3.1 (AD-13): `PUT /api/v1/me/nick` changes the nick; the server
 * normalizes it the same way as registration, so the body is sent as typed.
 */
export async function updateNick(nick: string): Promise<MeResult> {
  const result = await apiRequest<unknown>("/api/v1/me/nick", {
    method: "PUT",
    body: { nick },
  });
  if (!result.ok) return result;

  const parsed = meSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, data: parsed.data };
}

/**
 * CLE-129/D-59: `PATCH /api/v1/me/name` changes the display name shown on the
 * profile and in every list. The server trims the value and rewrites its search
 * key; the answer is the full `Me` (AD-12), so the screen keeps the server name.
 */
export async function updateName(name: string): Promise<MeResult> {
  const result = await apiRequest<unknown>("/api/v1/me/name", {
    method: "PATCH",
    body: { name },
  });
  if (!result.ok) return result;

  const parsed = meSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, data: parsed.data };
}

/**
 * Story 3.5 (FR-8, AD-13): `PATCH /api/v1/me/hide-from-search` stores the
 * settings switch. The answer is the full `Me`, so the screen keeps the server
 * value and never a local guess; the same strict contract check applies.
 */
export async function updateHideFromSearch(hideFromSearch: boolean): Promise<MeResult> {
  const result = await apiRequest<unknown>("/api/v1/me/hide-from-search", {
    method: "PATCH",
    body: { hideFromSearch },
  });
  if (!result.ok) return result;

  const parsed = meSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, data: parsed.data };
}

/**
 * Story 7.2 (FR-37): the explicit choice of the IANA zone in «Настройки».
 * `PATCH` overwrites the stored zone, unlike the device report (`PUT`). The
 * answer is the stored zone only; the screen merges it into the session user.
 */
export type TimeZoneChangeResult =
  | { ok: true; timeZone: string }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export async function changeTimeZone(timeZone: string): Promise<TimeZoneChangeResult> {
  const result = await apiRequest<unknown>("/api/v1/me/time-zone", {
    method: "PATCH",
    body: { timeZone },
  });
  if (!result.ok) return result;

  const data = result.data as { timeZone?: unknown } | null;
  if (data == null || typeof data.timeZone !== "string") return { ok: false, invalid: true };

  return { ok: true, timeZone: data.timeZone };
}

/**
 * CLE-129/T8.3 (D-58, AD-29): the profile fields of the owner come from
 * `GET /api/v1/me/profile` — `Me` plus the birthday pair, the gender, the ISO
 * country code, «Обо мне» and the friends switch. The answer always carries
 * every field for the owner, so `null` is "not set" and the form can tell an
 * empty value from an absent one.
 */
export type MyProfileResult =
  | { ok: true; data: MyProfile }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export async function getMyProfile(): Promise<MyProfileResult> {
  const result = await apiRequest<unknown>("/api/v1/me/profile");
  if (!result.ok) return result;

  const parsed = myProfileSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, data: parsed.data };
}

/**
 * `PATCH /api/v1/me/profile` is the only write path of the profile fields
 * (AD-29). An absent key means "leave as is"; the birthday is one pair, so the
 * form always sends both keys or both `null`. The answer is the whole
 * `MyProfile`, so the screen keeps the values the server normalized.
 */
export async function updateMyProfile(body: ProfileUpdateBody): Promise<MyProfileResult> {
  const result = await apiRequest<unknown>("/api/v1/me/profile", {
    method: "PATCH",
    body,
  });
  if (!result.ok) return result;

  const parsed = myProfileSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, data: parsed.data };
}

/**
 * FR-56 (CLE-129/T9.2): the email change has one neutral answer — the letter
 * was accepted — and never says whether the new address is free. The body is
 * re-checked with the shared contract, so a broken envelope is `invalid`, not a
 * success the screen would wrongly announce.
 */
export type EmailChangeResult =
  | { ok: true }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export async function requestEmailChange(email: string): Promise<EmailChangeResult> {
  const result = await apiRequest<unknown>("/api/v1/me/email", {
    method: "POST",
    body: { email },
  });
  if (!result.ok) return result;

  const parsed = emailChangeAcceptedSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true };
}

/**
 * Story 6.3 (FR-51, AD-20, D-33): the one self-serve account deletion. The body
 * carries `confirm: true`, so a stray call of the same route cannot wipe an
 * account; the server checks the session and the command itself removes the
 * lists, wishes, reservations, friends and sessions.
 *
 * A success means the account is gone (or was already gone, the command is
 * idempotent), so the local session is dead too: the bearer token and any
 * pending email hand-off are dropped here, and the screen moves to the guest
 * state. A failure keeps everything: `busy` only asks for a retry, and a
 * network error proves nothing about the account.
 */
export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const result = await apiRequest<unknown>("/api/v1/me", {
    method: "DELETE",
    body: { confirm: true },
  });
  if (!result.ok) return result;

  const parsed = accountDeletedSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  await clearSessionToken();
  forgetAuthEmail();
  return { ok: true };
}

/** «Отменить» in the waiting block: drops the pending wish on the server. */
export async function cancelEmailChange(): Promise<EmailChangeResult> {
  const result = await apiRequest<unknown>("/api/v1/me/email", { method: "DELETE" });
  if (!result.ok) return result;

  const parsed = emailChangeCancelledSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true };
}
