import "server-only";

import type { AuthContext } from "@better-auth/core";
import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context";
import { APIError } from "better-auth/api";

const RESET_TOKEN_PREFIX = "reset-password:";

function passwordReusedError(): never {
  throw APIError.from("BAD_REQUEST", {
    message: "Password reused",
    code: "PASSWORD_REUSED",
  });
}

async function matchesStoredPassword(
  password: string,
  storedHash: string,
  passwordApi: AuthContext["password"],
): Promise<boolean> {
  return passwordApi.verify({ password, hash: storedHash });
}

async function rejectIfSameAsStored(
  password: string,
  storedHash: string | null | undefined,
  passwordApi: AuthContext["password"],
): Promise<void> {
  if (!storedHash) return;
  if (await matchesStoredPassword(password, storedHash, passwordApi)) {
    passwordReusedError();
  }
}

async function userIdForResetToken(
  endpoint: NonNullable<ReturnType<typeof tryGetCurrentAuthEndpointContext>>,
): Promise<string | undefined> {
  const token =
    (endpoint.body as { token?: string } | undefined)?.token ??
    (endpoint.query as { token?: string } | undefined)?.token;
  if (!token) return undefined;
  const verification = await endpoint.context.internalAdapter.findVerificationValue(
    `${RESET_TOKEN_PREFIX}${token}`,
  );
  return verification?.value;
}

async function userIdForPasswordSet(
  path: string,
  endpoint: NonNullable<ReturnType<typeof tryGetCurrentAuthEndpointContext>>,
): Promise<string | undefined> {
  if (path === "/change-password") {
    return endpoint.context.session?.user?.id;
  }
  if (path === "/reset-password" || path === "/email-otp/reset-password" || path === "/phone-number/reset-password") {
    return userIdForResetToken(endpoint);
  }
  if (path === "/admin/set-user-password") {
    return (endpoint.body as { userId?: string } | undefined)?.userId;
  }
  return undefined;
}

/**
 * Rejects a new password that matches the user's current credential hash.
 * On change-password, reuse is checked only after `currentPassword` verifies.
 */
export async function rejectReusedPassword(
  newPassword: string,
  authContext: AuthContext,
): Promise<void> {
  const endpoint = tryGetCurrentAuthEndpointContext();
  const path = endpoint?.path;
  if (!endpoint || !path) return;

  const userId = await userIdForPasswordSet(path, endpoint);
  if (!userId) return;

  const account = await endpoint.context.internalAdapter.findCredentialAccount(userId);
  if (!account?.password) return;

  if (path === "/change-password") {
    const currentPassword = (endpoint.body as { currentPassword?: string } | undefined)?.currentPassword;
    if (currentPassword === undefined) return;
    const currentOk = await authContext.password.verify({
      password: currentPassword,
      hash: account.password,
    });
    if (!currentOk) return;
  }

  await rejectIfSameAsStored(newPassword, account.password, authContext.password);
}