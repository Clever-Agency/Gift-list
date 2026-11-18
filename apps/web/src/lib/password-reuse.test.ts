import { describe, expect, it, vi } from "vitest";
import { runWithEndpointContext } from "@better-auth/core/context";
import { rejectReusedPassword } from "@/lib/password-reuse";

vi.mock("server-only", () => ({}));

function passwordApi(overrides?: { verify?: (data: { password: string; hash: string }) => Promise<boolean> }) {
  const verify =
    overrides?.verify ??
    (async function verifyPassword(data: { password: string; hash: string }) {
      return data.password === "same-secret-12" && data.hash === "stored-hash";
    });
  return { verify, hash: vi.fn(), config: { minPasswordLength: 12, maxPasswordLength: 128 } };
}

function endpointContext(
  input: {
    path: string;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    session?: { user: { id: string } };
    accountPassword?: string | null;
    verificationUserId?: string;
  },
  password = passwordApi(),
) {
  const findCredentialAccount = vi.fn(async function findCredentialAccount() {
    if (input.accountPassword === null || input.accountPassword === undefined) return null;
    return { id: "acc-1", password: input.accountPassword, providerId: "credential", accountId: "u1", userId: "u1" };
  });
  const findVerificationValue = vi.fn(async function findVerificationValue(identifier: string) {
    if (input.verificationUserId && identifier === "reset-password:tok") {
      return {
        id: "v1",
        identifier,
        value: input.verificationUserId,
        expiresAt: new Date(Date.now() + 60_000),
      };
    }
    return null;
  });
  return {
    path: input.path,
    body: input.body,
    query: input.query,
    context: {
      session: input.session,
      internalAdapter: { findCredentialAccount, findVerificationValue },
      password,
    },
    passwordApi: password,
    findCredentialAccount,
    findVerificationValue,
  };
}

describe("rejectReusedPassword", () => {
  it("rejects a reset when the new password matches the stored hash", async () => {
    const ctx = endpointContext({
      path: "/reset-password",
      body: { token: "tok", newPassword: "same-secret-12" },
      accountPassword: "stored-hash",
      verificationUserId: "u1",
    });
    await expect(
      runWithEndpointContext(ctx as never, async function resetReuse() {
        await rejectReusedPassword("same-secret-12", { password: ctx.passwordApi } as never);
      }),
    ).rejects.toMatchObject({ body: { code: "PASSWORD_REUSED" } });
    expect(ctx.findVerificationValue).toHaveBeenCalledWith("reset-password:tok");
    expect(ctx.findCredentialAccount).toHaveBeenCalledWith("u1");
  });

  it("allows reset when the password differs", async () => {
    const ctx = endpointContext({
      path: "/reset-password",
      body: { token: "tok" },
      accountPassword: "stored-hash",
      verificationUserId: "u1",
    });
    await expect(
      runWithEndpointContext(ctx as never, async function resetOk() {
        await rejectReusedPassword("other-secret-12", { password: ctx.passwordApi } as never);
      }),
    ).resolves.toBeUndefined();
  });

  it("skips reuse checks when there is no credential hash", async () => {
    const ctx = endpointContext({
      path: "/reset-password",
      body: { token: "tok" },
      accountPassword: null,
      verificationUserId: "u1",
    });
    await expect(
      runWithEndpointContext(ctx as never, async function noHash() {
        await rejectReusedPassword("same-secret-12", { password: ctx.passwordApi } as never);
      }),
    ).resolves.toBeUndefined();
    expect(ctx.findCredentialAccount).toHaveBeenCalled();
  });

  it("on change-password, refuses reuse only after the current password verifies", async () => {
    const verify = vi.fn(async function verifyPair(data: { password: string; hash: string }) {
      if (data.password === "wrong-current") return false;
      return data.hash === "stored-hash" && (data.password === "current-secret" || data.password === "same-secret-12");
    });
    const password = passwordApi({ verify });
    const ctx = endpointContext(
      {
        path: "/change-password",
        body: { currentPassword: "current-secret", newPassword: "same-secret-12" },
        session: { user: { id: "u1" } },
        accountPassword: "stored-hash",
      },
      password,
    );

    await expect(
      runWithEndpointContext(ctx as never, async function changeReuse() {
        await rejectReusedPassword("same-secret-12", { password: ctx.passwordApi } as never);
      }),
    ).rejects.toMatchObject({ body: { code: "PASSWORD_REUSED" } });

    verify.mockClear();
    const wrongCtx = endpointContext(
      {
        path: "/change-password",
        body: { currentPassword: "wrong-current", newPassword: "same-secret-12" },
        session: { user: { id: "u1" } },
        accountPassword: "stored-hash",
      },
      password,
    );
    await expect(
      runWithEndpointContext(wrongCtx as never, async function wrongCurrent() {
        await rejectReusedPassword("same-secret-12", { password: wrongCtx.passwordApi } as never);
      }),
    ).resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith({ password: "wrong-current", hash: "stored-hash" });
  });

  it("reads a reset token from the query when the body token is missing or blank", async () => {
    for (const body of [{ newPassword: "same-secret-12" }, { token: "", newPassword: "same-secret-12" }]) {
      const ctx = endpointContext({
        path: "/reset-password",
        body,
        query: { token: "tok" },
        accountPassword: "stored-hash",
        verificationUserId: "u1",
      });
      await expect(
        runWithEndpointContext(ctx as never, async function queryToken() {
          await rejectReusedPassword("same-secret-12", { password: ctx.passwordApi } as never);
        }),
      ).rejects.toMatchObject({ body: { code: "PASSWORD_REUSED" } });
      expect(ctx.findVerificationValue).toHaveBeenCalledWith("reset-password:tok");
    }
  });
});