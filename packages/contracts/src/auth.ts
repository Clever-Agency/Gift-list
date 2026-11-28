import { z } from "zod";

/**
 * Caps of the account bodies. Exported because both clients repeat the same
 * numbers in their `maxLength` and hints; they must import them from here.
 *
 * Units: Zod 4 measures `min()`/`max()` in Unicode code points, while the
 * `maxLength` attribute of both clients measures UTF-16 units (two per character
 * outside the BMP). Each cap below therefore states its own unit; passwords are
 * the one field measured in UTF-16 units, because Better Auth measures them that
 * way — see {@link fitsPasswordUnits}.
 */
export const NICK_MIN = 3;
export const NICK_MAX = 24;
/** AD-13: 3–24 of `[a-z0-9_]`. Callers lowercase and trim before testing. */
export const NICK_PATTERN = new RegExp(`^[a-z0-9_]{${NICK_MIN},${NICK_MAX}}$`);

/** Why a nick is refused; `char` carries the first offending code point. */
export type NickIssue =
  | { code: "cyrillic" | "space" | "short" | "long" }
  | { code: "char"; char: string };

const NICK_CYRILLIC = /\p{Script=Cyrillic}/u;
const NICK_CHAR = /^[a-z0-9_]$/;

/**
 * AD-13: the first reason a nick is refused, in the order the screens show it —
 * Cyrillic, a space, another character, then the length. Upper case is not a
 * reason: the nick is lowercased before it is stored. An empty value is `short`,
 * which the screens show only on blur or submit. Characters are read as code
 * points, so `char` is a whole emoji, never half of a surrogate pair, and the
 * length is counted like the Zod schema counts it.
 */
export function nickIssue(value: string): NickIssue | null {
  if (NICK_CYRILLIC.test(value)) return { code: "cyrillic" };
  if (/\s/.test(value)) return { code: "space" };
  let length = 0;
  for (const char of value) {
    if (!NICK_CHAR.test(char.toLowerCase())) return { code: "char", char };
    length += 1;
  }
  if (length < NICK_MIN) return { code: "short" };
  return length > NICK_MAX ? { code: "long" } : null;
}

/** Shown in headings, the person row and the public link page. */
export const DISPLAY_NAME_MAX = 50;

/**
 * RFC 5321 caps a mailbox forward path at 254 characters; a longer address cannot
 * be delivered, so registration refuses it. Sign-in and password reset only look
 * an address up and keep the pre-cap shape (see `existingEmailSchema`).
 */
export const EMAIL_MAX = 254;

/**
 * Registration and reset password limits; Better Auth reads
 * `minPasswordLength` / `maxPasswordLength` from the same numbers in
 * `apps/web/src/lib/auth.ts`. It counts UTF-16 units, so the checks below count
 * the same unit — see {@link fitsPasswordUnits}.
 */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/** Machine reason when a new password is shorter than {@link PASSWORD_MIN}. */
export type NewPasswordLengthReason = "PASSWORD_TOO_SHORT" | "PASSWORD_TOO_LONG";

/**
 * Classifies a new password by UTF-16 length ({@link String#length}). Returns
 * `null` when the value sits within {@link PASSWORD_MIN}..{@link PASSWORD_MAX}.
 */
export function newPasswordLengthReason(password: string): NewPasswordLengthReason | null {
  if (password.length < PASSWORD_MIN) return "PASSWORD_TOO_SHORT";
  if (password.length > PASSWORD_MAX) return "PASSWORD_TOO_LONG";
  return null;
}

/**
 * A password is measured in UTF-16 code units (`String#length`), not in code
 * points: Better Auth compares `password.length` with its own
 * `minPasswordLength`/`maxPasswordLength`
 * (`better-auth/dist/utils/password.mjs:4-15`) when a password is set.
 * Sign-in calls only the upper-bound check, so a shorter stored password still
 * reaches the hash. A password
 * accepted here must not be one Better Auth refuses later, so the contract counts
 * the same unit — an emoji outside the BMP is two units. Zod's `.min()/.max()`
 * count code points and cannot express this.
 */
function fitsPasswordUnits(value: string): boolean {
  return value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;
}

/**
 * Sign-in keeps the stored lower bound at 1 (a legacy short password must pass
 * before the hash check); the upper bound matches the hash layer.
 */
function fitsStoredPasswordUnits(value: string): boolean {
  return value.length >= 1 && value.length <= PASSWORD_MAX;
}

const passwordFieldSchema = z.string().refine(fitsPasswordUnits, {
  message: `A password is ${PASSWORD_MIN} to ${PASSWORD_MAX} characters long`,
});

const storedPasswordFieldSchema = z.string().refine(fitsStoredPasswordUnits, {
  message: `A password is at most ${PASSWORD_MAX} characters long`,
});

/**
 * A new account: the address must be deliverable, so the length cap applies here.
 * Trimming comes first, so surrounding spaces never count against the cap.
 */
const newEmailSchema = z.string().trim().max(EMAIL_MAX).toLowerCase().pipe(z.email());

/**
 * Sign-in and password reset never store an address, they only look one up. No
 * length cap is added on purpose: an account created before the cap (this schema
 * accepted `z.email()` of any length) must still be able to sign in and reset its
 * password. `z.email()` itself imposes no length limit.
 */
const existingEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Registration and nick change validate the same way (AD-13). */
const nickSchema = z.string().trim().toLowerCase().pipe(z.string().regex(NICK_PATTERN));

/**
 * Cap of the `/i/:token` value sent with registration (AD-21, Story 4.7.1). It
 * matches the token pattern of the app paths, so a real link always fits.
 */
export const INVITE_TOKEN_MAX = 128;

/**
 * The invite token of `/i/:token`, forwarded by the app to registration. Only
 * the length is checked, never the format: a stale or foreign token must not
 * fail a registration — it only means that no friendship is created (AD-21).
 */
const inviteTokenSchema = z.string().trim().max(INVITE_TOKEN_MAX);

export const registerBodySchema = z.object({
  email: newEmailSchema,
  password: passwordFieldSchema,
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX),
  nick: nickSchema,
  inviteToken: inviteTokenSchema.optional(),
  next: z.string().optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const nickUpdateBodySchema = z.object({
  nick: nickSchema,
});

export type NickUpdateBody = z.infer<typeof nickUpdateBodySchema>;

/**
 * CLE-129/D-59: `/profile` edits the display name. The rule is the registration
 * one (AD-24: a name is written as given and never declined), so the trimmed
 * value is 1..{@link DISPLAY_NAME_MAX} code points and the route names the
 * `name` field for the screen.
 */
export const nameUpdateBodySchema = z.object({
  name: z.string().trim().min(1).max(DISPLAY_NAME_MAX),
});

export type NameUpdateBody = z.infer<typeof nameUpdateBodySchema>;

/**
 * FR-56 (CLE-129/T9.1, D-58): the address a user asks to move the account to.
 * The rule is the registration one — trimmed, lower-cased and deliverable — so a
 * value accepted here can actually receive the confirmation link. `User.email`
 * does not change until that link is opened; the contract only carries the wish.
 */
export const emailChangeBodySchema = z.object({
  email: newEmailSchema,
});

export type EmailChangeBody = z.infer<typeof emailChangeBodySchema>;

/**
 * CLE-129/T9.2 (FR-56): the neutral answer of a change request. It is the same
 * for a free and a taken address — the screen must not learn whether the new
 * mailbox is free before the link is opened.
 */
export const emailChangeAcceptedSchema = z.object({ accepted: z.literal(true) });

export type EmailChangeAccepted = z.infer<typeof emailChangeAcceptedSchema>;

/** The answer of a cancelled request: the letter is no longer expected. */
export const emailChangeCancelledSchema = z.object({ cancelled: z.literal(true) });

export type EmailChangeCancelled = z.infer<typeof emailChangeCancelledSchema>;

/**
 * Story 6.3 (FR-51, AD-20): the guard of `DELETE /api/v1/me`. The body must say
 * `confirm: true`, so a stray call from a form, a link or a broken client does
 * not wipe an account; any other value is a `VALIDATION` answer on `confirm`.
 */
export const accountDeletionBodySchema = z.object({ confirm: z.literal(true) });

export type AccountDeletionBody = z.infer<typeof accountDeletionBodySchema>;

/**
 * The answer of the one account-deletion command. The account is gone (or was
 * already gone, because the command is idempotent), so the client clears its
 * local session without looking at anything else.
 */
export const accountDeletedSchema = z.object({ deleted: z.literal(true) });

export type AccountDeleted = z.infer<typeof accountDeletedSchema>;

/**
 * Story 3.5 (FR-8): the settings switch stores one flag. Any other key is a
 * `VALIDATION` answer on `hideFromSearch` — the route names the field the
 * screen sent, instead of a bare rejection from `z.strictObject` (whose
 * `unrecognized_keys` issue has no path). The output is only the flag.
 */
export const hideFromSearchUpdateBodySchema = z
  .object({ hideFromSearch: z.boolean() })
  .passthrough()
  .superRefine(function onlyTheFlag(value, ctx) {
    for (const key of Object.keys(value)) {
      if (key === "hideFromSearch") continue;
      ctx.addIssue({
        code: "custom",
        path: ["hideFromSearch"],
        message: "Invalid input",
      });
    }
  })
  .transform(function toHideFromSearchUpdateBody(value) {
    return { hideFromSearch: value.hideFromSearch };
  });

export type HideFromSearchUpdateBody = z.infer<typeof hideFromSearchUpdateBodySchema>;

/**
 * `password` keeps the lower bound at 1 instead of `PASSWORD_MIN`: an account may
 * hold a shorter password from before the rule, and sign-in must not refuse it
 * before the hash is even checked. The upper bound is the same unit and number as
 * the hash layer (`fitsStoredPasswordUnits`).
 */
export const loginBodySchema = z.object({
  email: existingEmailSchema,
  password: storedPasswordFieldSchema,
  next: z.string().optional(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const passwordForgotBodySchema = z.object({
  email: existingEmailSchema,
});

export type PasswordForgotBody = z.infer<typeof passwordForgotBodySchema>;

/**
 * `token` is the raw reset-link query value. An omitted or blank token fails
 * on `token` so the route can answer `RESET_LINK_STALE`. Password length is
 * checked only after the token is present, so a short password does not spend it.
 */
export const passwordResetBodySchema = z
  .object({
    token: z.string().optional(),
    password: z.string().optional(),
  })
  .superRefine(function validatePasswordReset(value, ctx) {
    if (typeof value.token !== "string" || value.token.trim().length === 0) {
      ctx.addIssue({ code: "custom", path: ["token"], message: "Reset link is stale" });
      return;
    }
    if (typeof value.password !== "string" || !fitsPasswordUnits(value.password)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Invalid input" });
    }
  })
  .transform(function toPasswordResetBody(value) {
    return {
      token: value.token as string,
      password: value.password as string,
    };
  });

export type PasswordResetBody = z.infer<typeof passwordResetBodySchema>;

export const timeZoneBodySchema = z.object({
  timeZone: z.string().optional(),
});

export type TimeZoneBody = z.infer<typeof timeZoneBodySchema>;

const TOKEN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Relative return path only (AD-26). Anything else becomes `/`.
 * `/l/:token` opens the app wishlist; `/i/:token` opens the app invite path
 * because `/i` itself is served by Next.js.
 */
export function safeNextPath(input: unknown): string {
  if (typeof input !== "string") return "/";
  const value = input.trim();
  if (value.length === 0 || value.length > 2048) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  const pathEnd = value.search(/[?#]/);
  const rawPath = pathEnd === -1 ? value : value.slice(0, pathEnd);
  const suffix = pathEnd === -1 ? "" : value.slice(pathEnd);
  if (/%2f|%5c/i.test(rawPath)) return "/";

  const path = normalizeRelativePath(rawPath);
  if (path == null) return "/";
  const rewritten = rewriteAppPath(path);
  if (rewritten == null) return "/";
  return `${rewritten}${suffix}`;
}

function normalizeRelativePath(path: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (decoded.includes("\\") || decoded.includes("//") || !decoded.startsWith("/")) return null;
  const segments: string[] = [];
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join("/")}`;
}

function rewriteAppPath(path: string): string | null {
  const list = /^\/l\/([^/]+)$/.exec(path);
  if (list) return TOKEN.test(list[1] ?? "") ? `/wishlist/${list[1]}` : null;
  const invite = /^\/i\/([^/]+)$/.exec(path);
  if (invite) return TOKEN.test(invite[1] ?? "") ? `/invite/${invite[1]}` : null;
  if (path.includes("//")) return null;
  return path;
}
