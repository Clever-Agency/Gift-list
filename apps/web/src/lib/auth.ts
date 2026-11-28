import "server-only";

import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expo } from "@better-auth/expo";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { createId } from "@paralleldrive/cuid2";
import { PASSWORD_MAX, PASSWORD_MIN } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { haveIBeenPwnedPlugin } from "@/lib/hibp-password";
import { getEnv } from "@/lib/env";
import { sendEmailChangeEmail } from "@/lib/email-change-mail";
import {
  EMAIL_CHANGE_LINK_TTL_SECONDS,
  notifyPreviousEmailAfterChange,
} from "@/lib/email-change-pending";
import { sendPasswordResetEmail } from "@/lib/password-reset-mail";
import { invalidateOutstandingPasswordResets } from "@/lib/password-reset-tokens";
import { guardEmailChangeVerification } from "@/lib/email-change-verify";

function createAuth() {
  const env = getEnv();
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
    advanced: {
      database: {
        generateId: function generateId() {
          return createId();
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      // Sign-up goes through `registerUser` so the user and the single list
      // are created in one transaction (AD-6); the raw endpoint stays closed.
      disableSignUp: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      // Safe together with `transaction: true`: the token, the new password,
      // and session revocation commit or roll back as one unit.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async function sendResetPassword({ user, token }) {
        const locale = "locale" in user && typeof user.locale === "string" ? user.locale : null;
        try {
          await sendPasswordResetEmail({ to: user.email, locale, token });
        } catch (error) {
          console.error("Password reset email failed", error);
        }
      },
      // Вызывается после коммита пароля и отзыва сессий
      // (`revokeSessionsOnPasswordReset`). Better Auth к этому моменту удалил
      // только использованный токен — остальные ссылки этого пользователя гасим здесь,
      // в том числе если сброс пришёл сырым `POST /api/auth/reset-password`.
      onPasswordReset: async function onPasswordReset({ user }) {
        await invalidateOutstandingPasswordResets(user.id);
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
      // FR-56 (D-58, AD-3): a new address is confirmed by a one-time link to that
      // address; `User.email` changes only when the link is opened. Sessions,
      // nick, friendships and profile fields are not touched by the change.
      changeEmail: {
        enabled: true,
      },
    },
    emailVerification: {
      // One hour, the lifetime `email-change-pending` records in the same unit.
      expiresIn: EMAIL_CHANGE_LINK_TTL_SECONDS,
      // Only the change-email flow calls this in the product: the link is sent
      // to the **new** address, and the raw `/send-verification-email` path is
      // closed below, so it cannot be used to spam an address.
      sendVerificationEmail: async function sendVerificationEmail({ user, url }) {
        const locale = "locale" in user && typeof user.locale === "string" ? user.locale : null;
        await sendEmailChangeEmail({ to: user.email, locale, url });
      },
    },
    // FR-56, T9.2a: a change-email link that was cancelled or superseded must
    // not move the account. The pending row is the source of truth, so the
    // guard refuses such a link with `?error=INVALID_TOKEN` before Better Auth's
    // `/verify-email` writes anything.
    hooks: {
      before: createAuthMiddleware(async function beforeVerifyEmail(ctx) {
        await guardEmailChangeVerification(ctx);
      }),
    },
    // FR-56: Better Auth applies the change inside `/verify-email`; this hook
    // runs after that write commits. It reads the address the account left and
    // sends the «Email изменён» notice there, never before the change.
    databaseHooks: {
      user: {
        update: {
          after: async function afterUserUpdate(user) {
            if (!user || typeof user.id !== "string" || typeof user.email !== "string") return;
            // Runs after the commit, so a failure here must not turn a committed
            // change into an error answer; the notice is best-effort.
            try {
              await notifyPreviousEmailAfterChange({ id: user.id, email: user.email });
            } catch (error) {
              console.error("Email change notification hook failed", error);
            }
          },
        },
      },
    },
    // `giftlist://` — схема приложения (AD-3). Dev-origins (`exp://` для Expo Go,
    // `exp+giftlist://` для dev client) добавляются только через AUTH_DEV_TRUSTED_ORIGINS:
    // паттерн кастомной схемы без хоста совпадает с любым хостом и портом
    // (Better Auth matchesOriginPattern), поэтому в проде их быть не должно.
    trustedOrigins: ["giftlist://", ...env.AUTH_DEV_TRUSTED_ORIGINS],
    // Клиент и сброс ходят в `/api/v1` и `auth.api.*`. Сырые
    // `/sign-in/email`, `/sign-up/email` и `/request-password-reset` обошли бы
    // счётчики Postgres и упёрлись бы только в лимитер Better Auth в памяти
    // процесса. `/update-user` пишет `name` и `image` мимо `nameNormalized`
    // (CLE-109): поиск читает нормализованное имя. `/change-email` обошёл бы
    // лимит смены email и не оставил бы адрес, на который уходит уведомление
    // (FR-56); `/send-verification-email` рассылал бы письма по открытому
    // запросу. `disabledPaths` отвечает 404 до лимитера и до обработчика;
    // `auth.api.*` не затрагивается.
    disabledPaths: [
      "/sign-in/email",
      "/sign-up/email",
      "/request-password-reset",
      "/update-user",
      "/change-email",
      "/send-verification-email",
    ],
    // bearer() accepts `Authorization: Bearer` and adds `set-auth-token` to cookie-setting
    // responses; the /api/auth route strips that header for non-native requests.
    // nextCookies must stay last so Server Actions can set the session cookie.
    plugins: [expo(), bearer(), haveIBeenPwnedPlugin(), nextCookies()],
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
