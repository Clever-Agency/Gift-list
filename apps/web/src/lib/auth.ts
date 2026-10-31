import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/db/client";
import { getEnv } from "@/lib/env";

function createAuth() {
  const env = getEnv();
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    advanced: { database: { generateId: () => createId() } },
    emailAndPassword: {
      enabled: true,
      // Sign-up goes through the `register` action so the user and both lists
      // are created in one transaction (AD-6); the raw endpoint stays closed.
      disableSignUp: true,
    },
    user: {
      additionalFields: {
        nick: { type: "string", input: false },
        nickNormalized: { type: "string", input: false },
        hideFromSearch: { type: "boolean", input: false },
      },
    },
    // nextCookies must stay last so Server Actions can set the session cookie.
    plugins: [nextCookies()],
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
