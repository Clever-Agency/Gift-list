import { z } from "zod";

/**
 * Caps of the account bodies. Exported because both clients repeat the same
 * numbers in their `maxLength` and hints; they must import them from here.
 *
 * Units: Zod 4 measures `min()`/`max()` in Unicode code points, while the
 * `maxLength` attribute of both clients measures UTF-16 units (two per character
 * outside the BMP). The form therefore cuts before the schema accepts, and the
 * caps below are the schema's own numbers in the schema's own unit.
 *
 * Password caveat: Better Auth counts UTF-16 units, so a password made of
 * characters outside the BMP can fit `PASSWORD_MAX` code points and still exceed
 * 128 units, which Better Auth refuses at sign-in. Both numbers are kept as they
 * are; changing either side is a separate decision, not a silent edit here.
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
 * numbers (`minPasswordLength` 8, `maxPasswordLength` 128). The unit differs —
 * see the password caveat above.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

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
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
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
 * before the hash is even checked. The upper bound keeps the same number as the
 * hash layer (the unit caveat above applies).
 */
export const loginBodySchema = z.object({
  email: existingEmailSchema,
  password: z.string().min(1).max(PASSWORD_MAX),
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
    if (typeof value.password !== "string" || value.password.length < PASSWORD_MIN || value.password.length > PASSWORD_MAX) {
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
