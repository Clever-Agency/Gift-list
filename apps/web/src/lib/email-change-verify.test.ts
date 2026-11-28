import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signJWT } from "better-auth/crypto";

vi.mock("server-only", () => ({}));

const { userFindFirst, userUpdate, verificationFindFirst, verificationCreate, verificationDeleteMany } =
  vi.hoisted(() => ({
    userFindFirst: vi.fn(),
    userUpdate: vi.fn(),
    verificationFindFirst: vi.fn(),
    verificationCreate: vi.fn(),
    verificationDeleteMany: vi.fn(),
  }));

vi.mock("@/db/client", () => ({
  prisma: {
    user: { findFirst: userFindFirst, update: userUpdate },
    verification: {
      findFirst: verificationFindFirst,
      create: verificationCreate,
      deleteMany: verificationDeleteMany,
    },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  },
}));

vi.mock("@/lib/email-change-mail", () => ({
  sendEmailChangeEmail: vi.fn(),
  sendEmailChangedNotice: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn() };
  },
}));

import { sendEmailChangedNotice } from "@/lib/email-change-mail";
import {
  EMAIL_CHANGE_PENDING_PREFIX,
  forgetEmailChangeRequest,
  notifyPreviousEmailAfterChange,
  rememberEmailChangeRequest,
} from "@/lib/email-change-pending";
import {
  callbackWithError,
  guardEmailChangeVerification,
} from "@/lib/email-change-verify";

const secret = "01234567890123456789012345678901";
const oldEmail = "old@example.com";
const newEmail = "new@example.com";

type StoredRow = { identifier: string; value: string; expiresAt: Date };
let rows: StoredRow[] = [];

function setAuthEnv() {
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = secret;
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
}

function changeToken(input: { email?: string; updateTo?: string } = {}) {
  return signJWT(
    {
      email: input.email ?? oldEmail,
      updateTo: input.updateTo ?? newEmail,
      requestType: "change-email-verification",
    },
    secret,
  );
}

/**
 * The guard only uses `path`, `query` and `redirect`; the redirect is emulated
 * with a marker error, the way Better Auth throws `ctx.redirect` inside a hook.
 */
function hookContext(query: Record<string, unknown>) {
  return {
    path: "/verify-email",
    query,
    redirect(url: string): unknown {
      throw Object.assign(new Error("redirect"), { location: url });
    },
  };
}

function pendingRow() {
  return rows.find((row) => row.identifier === `${EMAIL_CHANGE_PENDING_PREFIX}u1`) ?? null;
}

const globalForAuth = globalThis as unknown as { auth?: unknown };

beforeEach(() => {
  rows = [];
  userFindFirst.mockReset();
  userUpdate.mockReset();
  verificationFindFirst.mockReset();
  verificationCreate.mockReset();
  verificationDeleteMany.mockReset();
  vi.mocked(sendEmailChangedNotice).mockReset();

  userFindFirst.mockImplementation(async () => ({ id: "u1" }));
  userUpdate.mockResolvedValue({});
  verificationFindFirst.mockImplementation(async (args: { where: { identifier: string } }) => {
    return rows.find((row) => row.identifier === args.where.identifier) ?? null;
  });
  verificationCreate.mockImplementation(async (args: { data: StoredRow }) => {
    rows.push(args.data);
    return args.data;
  });
  verificationDeleteMany.mockImplementation(async (args: { where: { identifier: string } }) => {
    const before = rows.length;
    rows = rows.filter((row) => row.identifier !== args.where.identifier);
    return { count: before - rows.length };
  });
  vi.mocked(sendEmailChangedNotice).mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete globalForAuth.auth;
});

describe("guardEmailChangeVerification", () => {
  it("refuses a link whose request was cancelled and keeps the address", async () => {
    await rememberEmailChangeRequest({ userId: "u1", oldEmail, newEmail, locale: "ru" });
    await forgetEmailChangeRequest("u1");

    const context = hookContext({
      token: await changeToken(),
      callbackURL: "/profile?emailChanged=1",
    });

    await expect(guardEmailChangeVerification(context)).rejects.toMatchObject({
      location: "/profile?emailChanged=1&error=INVALID_TOKEN",
    });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("refuses an older link after a newer request and accepts the newest one", async () => {
    await rememberEmailChangeRequest({ userId: "u1", oldEmail, newEmail, locale: "ru" });
    await rememberEmailChangeRequest({
      userId: "u1",
      oldEmail,
      newEmail: "newer@example.com",
      locale: "ru",
    });

    const older = hookContext({
      token: await changeToken({ updateTo: newEmail }),
      callbackURL: "/profile?emailChanged=1",
    });
    await expect(guardEmailChangeVerification(older)).rejects.toMatchObject({
      location: "/profile?emailChanged=1&error=INVALID_TOKEN",
    });

    const newest = hookContext({
      token: await changeToken({ updateTo: "newer@example.com" }),
      callbackURL: "/profile?emailChanged=1",
    });
    await expect(guardEmailChangeVerification(newest)).resolves.toBeUndefined();
  });

  it("refuses a link of an account that no longer has this address", async () => {
    await rememberEmailChangeRequest({ userId: "u1", oldEmail, newEmail, locale: "ru" });
    userFindFirst.mockResolvedValue(null);

    await expect(
      guardEmailChangeVerification(
        hookContext({ token: await changeToken(), callbackURL: "/profile?emailChanged=1" }),
      ),
    ).rejects.toMatchObject({ location: "/profile?emailChanged=1&error=INVALID_TOKEN" });
  });

  it("lets a pending change through and the notice then reaches the old address", async () => {
    await rememberEmailChangeRequest({ userId: "u1", oldEmail, newEmail, locale: "ru" });

    await expect(
      guardEmailChangeVerification(
        hookContext({ token: await changeToken(), callbackURL: "/profile?emailChanged=1" }),
      ),
    ).resolves.toBeUndefined();

    // Better Auth commits the new address and its update hook sends the notice.
    await notifyPreviousEmailAfterChange({ id: "u1", email: newEmail });

    expect(sendEmailChangedNotice).toHaveBeenCalledWith({
      to: oldEmail,
      locale: "ru",
      newEmail,
    });
    expect(pendingRow()).toBeNull();
  });

  it("does not look at the database for a plain address verification", async () => {
    const plainToken = await signJWT({ email: oldEmail }, secret);

    await expect(
      guardEmailChangeVerification(hookContext({ token: plainToken, callbackURL: "/profile" })),
    ).resolves.toBeUndefined();
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it("ignores other endpoints and a missing token", async () => {
    await expect(
      guardEmailChangeVerification({
        path: "/sign-in/email",
        query: { token: await changeToken() },
        redirect: () => new Error("redirect"),
      }),
    ).resolves.toBeUndefined();
    await expect(
      guardEmailChangeVerification(hookContext({ callbackURL: "/profile" })),
    ).resolves.toBeUndefined();
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it("answers a rejected link without a safe callback with a 401 instead of a redirect", async () => {
    await expect(
      guardEmailChangeVerification(hookContext({ token: await changeToken() })),
    ).rejects.toMatchObject({ name: "APIError", statusCode: 401 });

    await expect(
      guardEmailChangeVerification(
        hookContext({ token: await changeToken(), callbackURL: "https://evil.example/" }),
      ),
    ).rejects.toMatchObject({ name: "APIError", statusCode: 401 });
  });
});

describe("callbackWithError", () => {
  it("keeps an existing query and a hash of the callback", () => {
    expect(callbackWithError("/profile?emailChanged=1", "INVALID_TOKEN")).toBe(
      "/profile?emailChanged=1&error=INVALID_TOKEN",
    );
    expect(callbackWithError("/profile", "INVALID_TOKEN")).toBe(
      "/profile?error=INVALID_TOKEN",
    );
    expect(callbackWithError("/profile#email", "INVALID_TOKEN")).toBe(
      "/profile?error=INVALID_TOKEN#email",
    );
  });
});

describe("Better Auth /verify-email with a cancelled change", () => {
  async function openLink(token: string) {
    setAuthEnv();
    delete globalForAuth.auth;
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/[...all]/route");
    const callback = encodeURIComponent("/profile?emailChanged=1");
    return GET(
      new Request(
        `http://127.0.0.1:3000/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${callback}`,
      ),
    );
  }

  it("redirects with INVALID_TOKEN and never writes the new address", async () => {
    const token = await changeToken();
    // The row was removed by «Отменить»: the link is still signed and unexpired.
    const response = await openLink(token);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "/profile?emailChanged=1&error=INVALID_TOKEN",
    );
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
