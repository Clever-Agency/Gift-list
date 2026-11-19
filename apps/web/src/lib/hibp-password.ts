import "server-only";

import type { AuthContext } from "@better-auth/core";
import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context";
import { APIError } from "better-auth/api";
import { isPasswordCompromised } from "better-auth/plugins/haveibeenpwned";
import { rejectReusedPassword } from "@/lib/password-reuse";

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
function hibpDeadline(ms: number): { promise: Promise<"timeout">; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<"timeout">(function giveUp(resolve) {
    timer = setTimeout(function markTimeout() {
      resolve("timeout");
    }, ms);
  });
  return {
    promise,
    cancel() {
      clearTimeout(timer);
    },
  };
}

export async function isPasswordPwnedFailOpen(password: string): Promise<boolean> {
  const check = isPasswordCompromised(password);
  // The deadline may win first. A later rejection must not surface as unhandled.
  check.catch(function ignoreLateHibpFailure() {
    // Swallowed on purpose: see the comment above.
  });
  const deadline = hibpDeadline(HIBP_TIMEOUT_MS);
  try {
    const compromised = await Promise.race([check, deadline.promise]);
    deadline.cancel();
    if (compromised === "timeout") {
      console.error("HaveIBeenPwnedTimeout");
      return false;
    }
    return compromised;
  } catch (error) {
    deadline.cancel();
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
    init(ctx: AuthContext) {
      const originalHash = ctx.password.hash;
      return {
        context: {
          password: {
            ...ctx.password,
            async hash(password: string) {
              const path = tryGetCurrentAuthEndpointContext()?.path;
              if (!path || !PASSWORD_SET_PATHS.includes(path as (typeof PASSWORD_SET_PATHS)[number])) {
                return originalHash(password);
              }
              await rejectReusedPassword(password, ctx);
              await rejectCompromisedPassword(password);
              return originalHash(password);
            },
          },
        },
      };
    },
  };
}