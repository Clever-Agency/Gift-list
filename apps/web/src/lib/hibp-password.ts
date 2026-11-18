import "server-only";

import { APIError } from "better-auth/api";
import { isPasswordCompromised } from "better-auth/plugins/haveibeenpwned";
import { getCurrentAuthEndpointContext } from "@better-auth/core/context";

const HIBP_TIMEOUT_MS = 1500;

const PASSWORD_SET_PATHS = [
  "/sign-up/email",
  "/change-password",
  "/reset-password",
  "/email-otp/reset-password",
  "/phone-number/reset-password",
  "/admin/create-user",
  "/admin/set-user-password",
] as const;

/**
 * k-anonymity check with a hard timeout. Any failure or hang is fail-open: the
 * password is treated as not compromised and only the error name is logged.
 */
export async function isPasswordPwnedFailOpen(password: string): Promise<boolean> {
  try {
    const compromised = await Promise.race([
      isPasswordCompromised(password),
      new Promise<"timeout">((resolve) => {
        setTimeout(() => resolve("timeout"), HIBP_TIMEOUT_MS);
      }),
    ]);
    if (compromised === "timeout") {
      console.error("HaveIBeenPwnedTimeout");
      return false;
    }
    return compromised;
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error(name);
    return false;
  }
}

async function rejectCompromisedPassword(password: string): Promise<void> {
  if (await isPasswordPwnedFailOpen(password)) {
    throw APIError.from("BAD_REQUEST", {
      message: "Password compromised",
      code: "PASSWORD_COMPROMISED",
    });
  }
}

/**
 * Stock `haveIBeenPwned` id and path list without `/sign-in/email`, with a
 * fail-open wrapper around `isPasswordCompromised`.
 */
export function haveIBeenPwnedPlugin() {
  return {
    id: "have-i-been-pwned",
    init(ctx: {
      password: { hash: (password: string) => Promise<string> };
    }) {
      const originalHash = ctx.password.hash;
      return {
        context: {
          password: {
            ...ctx.password,
            async hash(password: string) {
              const endpoint = getCurrentAuthEndpointContext();
              if (!endpoint.path || !PASSWORD_SET_PATHS.includes(endpoint.path as (typeof PASSWORD_SET_PATHS)[number])) {
                return originalHash(password);
              }
              await rejectCompromisedPassword(password);
              return originalHash(password);
            },
          },
        },
      };
    },
  };
}