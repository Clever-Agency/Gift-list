import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/db/client";
import { getEnv } from "@/lib/env";

const env = getEnv();

export const auth = betterAuth({
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
