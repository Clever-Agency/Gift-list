import { z } from "zod";

/** AD-13: 3–24 of `[a-z0-9_]`. Callers lowercase and trim before testing. */
export const NICK_PATTERN = /^[a-z0-9_]{3,24}$/;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const registerBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(50),
  nick: z.string().trim().toLowerCase().pipe(z.string().regex(NICK_PATTERN)),
  next: z.string().optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  next: z.string().optional(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const passwordForgotBodySchema = z.object({
  email: emailSchema,
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
  .superRefine((value, ctx) => {
    if (typeof value.token !== "string" || value.token.trim().length === 0) {
      ctx.addIssue({ code: "custom", path: ["token"], message: "Reset link is stale" });
      return;
    }
    if (typeof value.password !== "string" || value.password.length < 8 || value.password.length > 128) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Invalid input" });
    }
  })
  .transform((value) => ({
    token: value.token as string,
    password: value.password as string,
  }));

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
