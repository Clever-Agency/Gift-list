import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
};

const rows: Row[] = [];

/**
 * In-memory `Verification`. `deleteMany` is what production cleanup calls.
 * The Better Auth stand-in below deletes only the used identifier, matching
 * `consumeVerificationValue` in better-auth 1.7.14.
 */
vi.mock("@/db/client", () => ({
  prisma: {
    verification: {
      deleteMany: async ({
        where,
      }: {
        where: { value?: string; identifier?: { startsWith?: string } };
      }) => {
        const prefix = where.identifier?.startsWith;
        const before = rows.length;
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          const row = rows[index];
          if (!row) continue;
          if (where.value !== undefined && row.value !== where.value) continue;
          if (prefix !== undefined && !row.identifier.startsWith(prefix)) continue;
          rows.splice(index, 1);
        }
        return { count: before - rows.length };
      },
    },
  },
}));

const secret = "01234567890123456789012345678901";
const globalForAuth = globalThis as unknown as { auth?: unknown };

function setAuthEnv() {
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = secret;
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.BRAND_NAME;
}

function future() {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function seed(overrides?: Partial<Record<"T1" | "T2", Date>>) {
  rows.length = 0;
  const expires = future();
  rows.push(
    { id: "t1", identifier: "reset-password:T1", value: "user-a", expiresAt: overrides?.T1 ?? expires },
    { id: "t2", identifier: "reset-password:T2", value: "user-a", expiresAt: overrides?.T2 ?? expires },
    { id: "t3", identifier: "reset-password:T3", value: "user-b", expiresAt: expires },
    { id: "mail", identifier: "email-verification:abc", value: "user-a", expiresAt: expires },
  );
}

function identifiers() {
  return rows.map((row) => row.identifier).sort();
}

function invalidToken() {
  return Object.assign(new Error("Invalid token"), { body: { code: "INVALID_TOKEN" } });
}

let resetPassword: typeof import("./password-reset").resetPassword;
let providerCalls = 0;

beforeAll(async () => {
  setAuthEnv();
  vi.resetModules();
  delete globalForAuth.auth;
  const { auth } = await import("@/lib/auth");
  ({ resetPassword } = await import("./password-reset"));

  const api = auth.api as { resetPassword: typeof auth.api.resetPassword };
  api.resetPassword = (async ({ body }: { body: { newPassword: string; token: string } }) => {
    providerCalls += 1;
    if (body.newPassword.length < 8) {
      throw Object.assign(new Error("Password too short"), { body: { code: "PASSWORD_TOO_SHORT" } });
    }
    if (body.newPassword.length > 128) {
      throw Object.assign(new Error("Password too long"), { body: { code: "PASSWORD_TOO_LONG" } });
    }
    const identifier = `reset-password:${body.token}`;
    const index = rows.findIndex((row) => row.identifier === identifier);
    const row = index >= 0 ? rows[index] : undefined;
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      if (row) rows.splice(index, 1);
      throw invalidToken();
    }
    const userId = row.value;
    rows.splice(index, 1);
    const hook = auth.options.emailAndPassword?.onPasswordReset;
    if (!hook) throw new Error("onPasswordReset is not configured");
    await hook({ user: { id: userId } } as never);
    return { status: true };
  }) as typeof auth.api.resetPassword;
});

beforeEach(() => {
  providerCalls = 0;
  seed();
});

afterAll(() => {
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete globalForAuth.auth;
});

describe("resetPassword outstanding links", () => {
  it("rejects T1 after a successful reset via T2", async () => {
    const saved = await resetPassword({ token: "T2", password: "password1" });
    expect(saved).toEqual({ ok: true, data: { saved: true } });
    expect(identifiers()).toEqual(["email-verification:abc", "reset-password:T3"]);

    const again = await resetPassword({ token: "T1", password: "password2" });
    expect(again).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Reset link is stale",
      reason: "RESET_LINK_STALE",
    });
    expect(identifiers()).toEqual(["email-verification:abc", "reset-password:T3"]);

    const otherUser = await resetPassword({ token: "T3", password: "password3" });
    expect(otherUser).toEqual({ ok: true, data: { saved: true } });
    expect(identifiers()).toEqual(["email-verification:abc"]);
  });

  it("leaves a live sibling when the used link is expired or unknown", async () => {
    seed({ T2: new Date(Date.now() - 60_000) });
    const expired = await resetPassword({ token: "T2", password: "password1" });
    expect(expired).toMatchObject({ ok: false, reason: "RESET_LINK_STALE" });
    expect(identifiers()).toContain("reset-password:T1");
    expect(identifiers()).not.toContain("reset-password:T2");

    providerCalls = 0;
    seed();
    const unknown = await resetPassword({ token: "missing", password: "password1" });
    expect(unknown).toMatchObject({ ok: false, reason: "RESET_LINK_STALE" });
    expect(providerCalls).toBe(1);
    expect(identifiers()).toEqual([
      "email-verification:abc",
      "reset-password:T1",
      "reset-password:T2",
      "reset-password:T3",
    ]);

    const saved = await resetPassword({ token: "T1", password: "password1" });
    expect(saved).toEqual({ ok: true, data: { saved: true } });
    expect(identifiers()).not.toContain("reset-password:T2");
  });

  it("does not spend sibling links when the password is rejected or the token is blank", async () => {
    const short = await resetPassword({ token: "T1", password: "short" });
    expect(short).toMatchObject({ ok: false, code: "VALIDATION", field: "password" });
    expect(short).not.toHaveProperty("reason");
    expect(providerCalls).toBe(1);
    expect(identifiers()).toContain("reset-password:T1");
    expect(identifiers()).toContain("reset-password:T2");

    providerCalls = 0;
    const blank = await resetPassword({ token: "   ", password: "password1" });
    expect(blank).toMatchObject({ ok: false, reason: "RESET_LINK_STALE" });
    expect(providerCalls).toBe(0);
    expect(identifiers()).toContain("reset-password:T1");
    expect(identifiers()).toContain("reset-password:T2");
  });
});
