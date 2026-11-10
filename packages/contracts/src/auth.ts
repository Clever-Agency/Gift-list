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

/** Shown in headings, the person row and the public link page. */
export const DISPLAY_NAME_MAX = 50;

/**
 * RFC 5321 caps a mailbox forward path at 254 characters; a longer address cannot
 * be delivered, so registration refuses it. Sign-in and password reset only look
 * an address up and keep the pre-cap shape (see `existingEmailSchema`).
 */
export const EMAIL_MAX = 254;

/**
 * Registration and reset password limits; Better Auth's defaults are the same
 * numbers (`minPasswordLength` 8, `maxPasswordLength` 128) but it counts UTF-16
 * units, so the checks below count the same unit — see {@link fitsPasswordUnits}.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/**
 * A password is measured in UTF-16 code units (`String#length`), not in code
 * points: Better Auth compares `password.length` with its own
 * `minPasswordLength`/`maxPasswordLength`
 * (`better-auth/dist/utils/password.mjs:4-15`, defaults 8/128 from
 * `dist/context/create-context.mjs:186-187`) at sign-in and reset. A password
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

export const registerBodySchema = z.object({
  email: newEmailSchema,
  password: passwordFieldSchema,
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX),
  nick: nickSchema,
  next: z.string().optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const nickUpdateBodySchema = z.object({
  nick: nickSchema,
});

export type NickUpdateBody = z.infer<typeof nickUpdateBodySchema>;

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
