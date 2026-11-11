import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { signInEmail, findUnique, consumeRateLimit } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  findUnique: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { signInEmail } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique } } }));
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, consumeRateLimit };
});

import { POST } from "./route";
import { DEFAULT_AUTH_RATE_LIMIT } from "@/lib/rate-limit";

function emailKey(email: string): string {
  return `sign-in-email:${createHash("sha256").update(email).digest("hex")}`;
}

const user = {
  id: "u1",
  email: "a@example.com",
  name: "Анна",
  nick: "anna",
  timeZone: "Europe/Minsk",
};

function post(body: unknown, ip = "203.0.113.8") {
  return new Request("http://127.0.0.1:3000/api/v1/session", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  signInEmail.mockReset();
  findUnique.mockReset();
  consumeRateLimit.mockReset();
  consumeRateLimit.mockResolvedValue({ allowed: true });
  signInEmail.mockResolvedValue(new Response(null, { status: 401 }));
  findUnique.mockResolvedValue(user);
});

describe("POST /api/v1/session", () => {
  it("opens a session while both counters allow it", async () => {
    signInEmail.mockResolvedValue(new Response(null, { status: 200 }));
    const res = await POST(post({ email: "  A@Example.com ", password: "password1", next: "/l/tok_1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      data: {
        user: { ...user, email: "a@example.com", timeZone: "Europe/Minsk" },
        next: "/wishlist/tok_1",
      },
    });
    expect(consumeRateLimit).toHaveBeenNthCalledWith(1, "sign-in:203.0.113.8", DEFAULT_AUTH_RATE_LIMIT);
    expect(consumeRateLimit).toHaveBeenNthCalledWith(2, emailKey("a@example.com"), DEFAULT_AUTH_RATE_LIMIT);
    expect(JSON.stringify(consumeRateLimit.mock.calls)).not.toContain("example.com");
    expect(signInEmail).toHaveBeenCalledTimes(1);
  });

  it("does not count a body the schema rejects", async () => {
    const res = await POST(post({ email: "not-an-email", password: "password1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "VALIDATION", field: "email" });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("does not cap the length of a stored address, so an older account is never locked out", async () => {
    // Registration caps a new address at 254 characters; sign-in only looks one
    // up, so a longer address stored before that rule still reaches the hash check.
    const legacy = `${"a".repeat(60)}@${"b".repeat(230)}.com`;
    expect(legacy.length).toBeGreaterThan(254);
    findUnique.mockResolvedValue({ ...user, email: legacy });
    signInEmail.mockResolvedValue(new Response(null, { status: 200 }));

    const res = await POST(post({ email: legacy, password: "password1" }));

    expect(res.status).toBe(200);
    expect(signInEmail).toHaveBeenCalledWith({
      body: { email: legacy, password: "password1" },
      headers: expect.any(Headers),
      asResponse: true,
    });
  });

  it("rejects a 65-emoji password (130 UTF-16 units) before any hash work", async () => {
    const password = "😀".repeat(65);
    expect(password.length).toBe(130);

    const res = await POST(post({ email: "a@example.com", password }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "password",
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("passes a 64-emoji password (exactly 128 UTF-16 units) to Better Auth", async () => {
    signInEmail.mockResolvedValue(new Response(null, { status: 200 }));
    const password = "😀".repeat(64);

    const res = await POST(post({ email: "a@example.com", password }));

    expect(res.status).toBe(200);
    expect(signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: { email: "a@example.com", password } }),
    );
  });

  it("answers 429 after 5 attempts from one IP, for a known or unknown email", async () => {
    const calls: string[] = [];
    consumeRateLimit.mockImplementation(async (key: string, limit: { max: number; windowSeconds: number }) => {
      expect(limit).toEqual(DEFAULT_AUTH_RATE_LIMIT);
      calls.push(key);
      const used = calls.filter((item) => item === key).length;
      return used <= 5 ? { allowed: true } : { allowed: false, retryAfterSeconds: 125 };
    });

    for (let n = 0; n < 5; n += 1) {
      const res = await POST(post({ email: "a@example.com", password: "wrong-password" }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        ok: false,
        code: "UNAUTHENTICATED",
        message: "Invalid email or password",
      });
    }

    const known = await POST(post({ email: "a@example.com", password: "password1" }));
    const unknown = await POST(post({ email: "missing@example.com", password: "password1" }, "203.0.113.8"));
    const knownBody = await known.json();
    const unknownBody = await unknown.json();
    expect(known.status).toBe(429);
    expect(unknown.status).toBe(429);
    expect(knownBody).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many sign-in attempts",
      params: { unit: "minute", count: 3 },
    });
    expect(unknownBody).toEqual(knownBody);
    expect(JSON.stringify(knownBody)).not.toContain("example.com");
    expect(signInEmail).toHaveBeenCalledTimes(5);
    expect(calls.filter((key) => key === "sign-in:203.0.113.8").length).toBe(7);
  });

  it("answers 429 after 5 attempts for one email from different IPs", async () => {
    const calls: string[] = [];
    consumeRateLimit.mockImplementation(async (key: string) => {
      calls.push(key);
      const used = calls.filter((item) => item === key).length;
      return used <= 5 ? { allowed: true } : { allowed: false, retryAfterSeconds: 60 };
    });

    for (let n = 0; n < 5; n += 1) {
      const res = await POST(post({ email: "a@example.com", password: "wrong-password" }, `203.0.113.${n}`));
      expect(res.status).toBe(401);
    }
    const limited = await POST(post({ email: "a@example.com", password: "password1" }, "198.51.100.9"));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many sign-in attempts",
      params: { unit: "minute", count: 1 },
    });
    expect(signInEmail).toHaveBeenCalledTimes(5);
    expect(calls.filter((key) => key === emailKey("a@example.com")).length).toBe(6);
    expect(calls.join(" ")).not.toContain("a@example.com");
  });

  it("counts an unknown email on its own key and does not look the account up", async () => {
    const calls: string[] = [];
    consumeRateLimit.mockImplementation(async (key: string) => {
      calls.push(key);
      const used = calls.filter((item) => item === key).length;
      return used <= 5 ? { allowed: true } : { allowed: false, retryAfterSeconds: 60 };
    });

    for (let n = 0; n < 5; n += 1) {
      const res = await POST(
        post({ email: "missing@example.com", password: "wrong-password" }, `198.51.100.${n}`),
      );
      expect(res.status).toBe(401);
    }
    const limited = await POST(
      post({ email: "missing@example.com", password: "password1" }, "198.51.100.20"),
    );
    const body = await limited.json();
    expect(limited.status).toBe(429);
    expect(body).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(JSON.stringify(body)).not.toContain("missing@example.com");
    expect(signInEmail).toHaveBeenCalledTimes(5);
    expect(findUnique).not.toHaveBeenCalled();
    expect(calls.filter((key) => key === emailKey("missing@example.com")).length).toBe(6);
  });
});
