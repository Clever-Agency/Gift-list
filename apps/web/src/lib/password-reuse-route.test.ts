import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "better-auth/crypto";

vi.mock("server-only", () => ({}));

vi.mock("better-auth/plugins/haveibeenpwned", () => ({
  isPasswordCompromised: vi.fn(async function notCompromised() {
    return false;
  }),
}));

type Row = Record<string, unknown>;

const memory = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {
    user: [],
    account: [],
    verification: [],
    session: [],
  };

  function time(value: unknown): number {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return Number.NaN;
  }

  function same(left: unknown, right: unknown): boolean {
    const leftTime = time(left);
    const rightTime = time(right);
    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && (left instanceof Date || right instanceof Date)) {
      return leftTime === rightTime;
    }
    return left === right;
  }

  function matchField(actual: unknown, expected: unknown): boolean {
    if (expected instanceof Date) return same(actual, expected);
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const filter = expected as Record<string, unknown>;
      if ("equals" in filter) return same(actual, filter.equals);
      if ("lt" in filter) return time(actual) < time(filter.lt);
      if ("gt" in filter) return time(actual) > time(filter.gt);
      if ("lte" in filter) return time(actual) <= time(filter.lte);
      if ("gte" in filter) return time(actual) >= time(filter.gte);
      if (typeof filter.startsWith === "string" && typeof actual === "string") {
        return actual.startsWith(filter.startsWith);
      }
      if (Array.isArray(filter.in)) return filter.in.some((item) => same(actual, item));
      if ("not" in filter) {
        const excluded = filter.not;
        if (excluded && typeof excluded === "object" && "equals" in excluded) {
          return !same(actual, (excluded as { equals: unknown }).equals);
        }
        return !same(actual, excluded);
      }
    }
    return same(actual, expected);
  }

  function matchWhere(row: Row, where: unknown): boolean {
    if (!where || typeof where !== "object") return true;
    const clause = where as Record<string, unknown>;
    if (Array.isArray(clause.AND) && !clause.AND.every((part) => matchWhere(row, part))) return false;
    if (Array.isArray(clause.OR) && clause.OR.length > 0 && !clause.OR.some((part) => matchWhere(row, part))) {
      return false;
    }
    for (const [key, value] of Object.entries(clause)) {
      if (key === "AND" || key === "OR") continue;
      if (!matchField(row[key], value)) return false;
    }
    return true;
  }

  function missing(): never {
    const error = new Error("Record not found") as Error & { code: string };
    error.code = "P2025";
    throw error;
  }

  function model(name: string) {
    return {
      async create({ data }: { data: Row }) {
        const row = { ...data };
        tables[name]?.push(row);
        return row;
      },
      async findFirst({ where }: { where?: unknown }) {
        return tables[name]?.find((row) => matchWhere(row, where)) ?? null;
      },
      async findMany(args: {
        where?: unknown;
        orderBy?: Record<string, "asc" | "desc">;
        take?: number;
        skip?: number;
      }) {
        let rows = (tables[name] ?? []).filter((row) => matchWhere(row, args.where));
        const order = args.orderBy ? Object.entries(args.orderBy)[0] : undefined;
        if (order) {
          const [field, direction] = order;
          rows = [...rows].sort(function byField(left, right) {
            const delta = time(left[field]) - time(right[field]);
            return direction === "desc" ? -delta : delta;
          });
        }
        const start = args.skip ?? 0;
        return rows.slice(start, args.take ? start + args.take : undefined);
      },
      async update({ where, data }: { where: unknown; data: Row }) {
        const rows = tables[name] ?? [];
        const index = rows.findIndex((row) => matchWhere(row, where));
        if (index < 0) missing();
        rows[index] = { ...rows[index], ...data };
        return rows[index];
      },
      async updateMany({ where, data }: { where: unknown; data: Row }) {
        let count = 0;
        const rows = tables[name] ?? [];
        for (let index = 0; index < rows.length; index += 1) {
          const row = rows[index];
          if (!row || !matchWhere(row, where)) continue;
          rows[index] = { ...row, ...data };
          count += 1;
        }
        return { count };
      },
      async delete({ where }: { where: unknown }) {
        const rows = tables[name] ?? [];
        const index = rows.findIndex((row) => matchWhere(row, where));
        if (index < 0) missing();
        const [row] = rows.splice(index, 1);
        return row;
      },
      async deleteMany({ where }: { where?: unknown }) {
        const rows = tables[name] ?? [];
        const kept = rows.filter((row) => !matchWhere(row, where));
        const count = rows.length - kept.length;
        tables[name] = kept;
        return { count };
      },
    };
  }

  const client = {
    user: model("user"),
    account: model("account"),
    verification: model("verification"),
    session: model("session"),
    $transaction(work: (tx: unknown) => unknown) {
      return work(client);
    },
  };

  return { tables, client };
});

vi.mock("@/db/client", () => ({ prisma: memory.client }));

const secret = "01234567890123456789012345678901";
const currentPassword = "current-secret-1";
const otherPassword = "another-secret-1";
const globalForAuth = globalThis as unknown as { auth?: unknown };

function setAuthEnv() {
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = secret;
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.BRAND_NAME;
}

function identifiers() {
  return memory.tables.verification.map((row) => row.identifier);
}

function credentialHash() {
  const account = memory.tables.account.find((row) => row.providerId === "credential");
  return typeof account?.password === "string" ? account.password : "";
}

async function seed() {
  for (const name of Object.keys(memory.tables)) memory.tables[name] = [];
  const now = new Date();
  const userId = "user-1";
  memory.tables.user.push({
    id: userId,
    name: "Анна",
    nameNormalized: "анна",
    email: "a@example.com",
    emailVerified: true,
    nick: "anna",
    nickNormalized: "anna",
    hideFromSearch: false,
    locale: "ru",
    createdAt: now,
    updatedAt: now,
  });
  memory.tables.account.push({
    id: "acc-1",
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(currentPassword),
    createdAt: now,
    updatedAt: now,
  });
  memory.tables.verification.push(
    {
      id: "ver-1",
      identifier: "reset-password:live-token",
      value: userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "ver-2",
      identifier: "reset-password:sibling-token",
      value: userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    },
  );
}

function post(path: string, body: unknown, cookie?: string) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://127.0.0.1:3000",
  });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`http://127.0.0.1:3000${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("raw password routes reject the current password", () => {
  beforeEach(async () => {
    setAuthEnv();
    delete globalForAuth.auth;
    vi.resetModules();
    await seed();
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;
    delete globalForAuth.auth;
  });

  it("keeps the reset link when /api/auth/reset-password repeats the current password", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(function silence() {});
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const stored = credentialHash();

    const reused = await POST(
      post("/api/auth/reset-password", { newPassword: currentPassword, token: "live-token" }),
    );
    expect(reused.status).toBe(400);
    expect(await reused.json()).toMatchObject({ code: "PASSWORD_REUSED" });
    expect(identifiers()).toEqual(expect.arrayContaining(["reset-password:live-token", "reset-password:sibling-token"]));
    expect(credentialHash()).toBe(stored);
    expect(await verifyPassword({ hash: stored, password: currentPassword })).toBe(true);

    const queryOnly = await POST(
      post("/api/auth/reset-password?token=live-token", { newPassword: currentPassword }),
    );
    expect(queryOnly.status).toBe(400);
    expect(await queryOnly.json()).toMatchObject({ code: "PASSWORD_REUSED" });
    expect(identifiers()).toContain("reset-password:live-token");
    expect(credentialHash()).toBe(stored);

    const blankBodyToken = await POST(
      post("/api/auth/reset-password?token=live-token", { newPassword: currentPassword, token: "" }),
    );
    expect(blankBodyToken.status).toBe(400);
    expect(await blankBodyToken.json()).toMatchObject({ code: "PASSWORD_REUSED" });
    expect(identifiers()).toEqual(
      expect.arrayContaining(["reset-password:live-token", "reset-password:sibling-token"]),
    );
    expect(credentialHash()).toBe(stored);

    const saved = await POST(
      post("/api/auth/reset-password", { newPassword: otherPassword, token: "live-token" }),
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ status: true });
    expect(identifiers()).not.toContain("reset-password:live-token");
    expect(identifiers()).not.toContain("reset-password:sibling-token");
    const nextHash = credentialHash();
    expect(nextHash).not.toBe(stored);
    expect(await verifyPassword({ hash: nextHash, password: otherPassword })).toBe(true);
    expect(await verifyPassword({ hash: nextHash, password: currentPassword })).toBe(false);

    const logged = errors.mock.calls.flat().map((part) => String(part)).join(" ");
    expect(logged).not.toContain(currentPassword);
    expect(logged).not.toContain(otherPassword);
    expect(logged).not.toContain(stored);
    expect(logged).not.toContain(nextHash);
    errors.mockRestore();
  });

  it("rejects /api/auth/change-password only after the current password matches", async () => {
    const { auth } = await import("@/lib/auth");
    const { POST } = await import("@/app/api/auth/[...all]/route");
    const signed = await auth.api.signInEmail({
      body: { email: "a@example.com", password: currentPassword },
      headers: new Headers({ origin: "http://127.0.0.1:3000" }),
      returnHeaders: true,
    });
    const setCookie = signed.headers?.get("set-cookie") ?? "";
    expect(setCookie).toContain("session");
    const cookie = setCookie.split(";")[0] ?? "";
    const stored = credentialHash();

    const reused = await POST(
      post(
        "/api/auth/change-password",
        { newPassword: currentPassword, currentPassword, revokeOtherSessions: false },
        cookie,
      ),
    );
    expect(reused.status).toBe(400);
    expect(await reused.json()).toMatchObject({ code: "PASSWORD_REUSED" });
    expect(credentialHash()).toBe(stored);

    const wrong = await POST(
      post(
        "/api/auth/change-password",
        { newPassword: currentPassword, currentPassword: "wrong-current-1", revokeOtherSessions: false },
        cookie,
      ),
    );
    expect(wrong.status).toBe(400);
    const wrongBody = (await wrong.json()) as { code?: string };
    expect(wrongBody.code).not.toBe("PASSWORD_REUSED");
    expect(credentialHash()).toBe(stored);

    const saved = await POST(
      post(
        "/api/auth/change-password",
        { newPassword: otherPassword, currentPassword, revokeOtherSessions: false },
        cookie,
      ),
    );
    expect(saved.status).toBe(200);
    const nextHash = credentialHash();
    expect(await verifyPassword({ hash: nextHash, password: otherPassword })).toBe(true);
    expect(await verifyPassword({ hash: nextHash, password: currentPassword })).toBe(false);
  });
});
