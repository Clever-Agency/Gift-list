import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/db/client";
import { getEnv } from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/password-reset-mail";

function createAuth() {
  const env = getEnv();
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
    advanced: { database: { generateId: () => createId() } },
    emailAndPassword: {
      enabled: true,
      // Sign-up goes through `registerUser` so the user and the single list
      // are created in one transaction (AD-6); the raw endpoint stays closed.
      disableSignUp: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      // Safe together with `transaction: true`: the token, the new password,
      // and session revocation commit or roll back as one unit.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        const locale = "locale" in user && typeof user.locale === "string" ? user.locale : null;
        try {
          await sendPasswordResetEmail({ to: user.email, locale, token });
        } catch (error) {
          console.error("Password reset email failed", error);
        }
      },
    },
    user: {
      additionalFields: {
        nick: { type: "string", input: false },
        nickNormalized: { type: "string", input: false },
        hideFromSearch: { type: "boolean", input: false },
        locale: { type: "string", required: false, input: false, defaultValue: "ru" },
        timeZone: { type: "string", required: false, input: false },
      },
    },
    // `giftlist://` — схема приложения (AD-3). Dev-origins (`exp://` для Expo Go,
    // `exp+giftlist://` для dev client) добавляются только через AUTH_DEV_TRUSTED_ORIGINS:
    // паттерн кастомной схемы без хоста совпадает с любым хостом и портом
    // (Better Auth matchesOriginPattern), поэтому в проде их быть не должно.
    trustedOrigins: ["giftlist://", ...env.AUTH_DEV_TRUSTED_ORIGINS],
    // bearer() accepts `Authorization: Bearer` and adds `set-auth-token` to cookie-setting
    // responses; the /api/auth route strips that header for non-native requests.
    // nextCookies must stay last so Server Actions can set the session cookie.
    plugins: [expo(), bearer(), nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { auth?: Auth };

let authSingleton = globalForAuth.auth;

function getAuth(): Auth {
  if (authSingleton) return authSingleton;
  authSingleton = createAuth();
  if (process.env.NODE_ENV !== "production") {
    globalForAuth.auth = authSingleton;
  }
  return authSingleton;
}

/**
 * Better Auth instance. Built on first use so `next build` does not need secrets.
 * `has` is required: `toNextJsHandler` checks `"handler" in auth` before calling it.
 */
export const auth: Auth = new Proxy(function authProxy() {} as unknown as Auth, {
  get(_target, prop) {
    if (prop === "then") return undefined;
    const instance = getAuth();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, prop) {
    if (prop === "then") return false;
    return prop in getAuth();
  },
  apply(_target, thisArg, args: unknown[]) {
    const instance = getAuth() as unknown as (...params: unknown[]) => unknown;
    return Reflect.apply(instance, thisArg, args);
  },
});
