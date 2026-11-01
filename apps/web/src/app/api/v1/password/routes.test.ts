import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requestPasswordReset, resetPassword, consumeRateLimit } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { requestPasswordReset, resetPassword } } }));
vi.mock("@/db/client", () => ({ prisma: {} }));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ BETTER_AUTH_URL: "http://127.0.0.1:3000" }),
}));
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return { ...actual, consumeRateLimit };
});

import { POST as forgot } from "./forgot/route";
import { POST as reset } from "./reset/route";

const providerMessage = "If this email exists in our system, check your email for the reset link";

function post(path: string, body: unknown, ip = "203.0.113.8") {
  return new Request(`http://127.0.0.1:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requestPasswordReset.mockReset();
  resetPassword.mockReset();
  consumeRateLimit.mockReset();
  consumeRateLimit.mockResolvedValue({ allowed: true });
  requestPasswordReset.mockResolvedValue({ status: true, message: providerMessage });
  resetPassword.mockResolvedValue({ status: true });
});

describe("POST /api/v1/password/forgot", () => {
  it("forgot-blind returns the same accepted body and does not forward the provider", async () => {
    const known = await forgot(post("/api/v1/password/forgot", { email: "known@example.com" }));
    const unknown = await forgot(post("/api/v1/password/forgot", { email: "missing@example.com" }));
    const knownBody = await known.json();
    const unknownBody = await unknown.json();
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(knownBody).toEqual({ ok: true, data: { accepted: true } });
    expect(unknownBody).toEqual(knownBody);
    expect(JSON.stringify(knownBody)).not.toContain("exists");
    expect(JSON.stringify(knownBody)).not.toContain("known@example.com");
    expect(requestPasswordReset).toHaveBeenNthCalledWith(1, {
      body: { email: "known@example.com", redirectTo: "http://127.0.0.1:3000/reset" },
      headers: expect.any(Headers),
    });
    expect(requestPasswordReset).toHaveBeenNthCalledWith(2, {
      body: { email: "missing@example.com", redirectTo: "http://127.0.0.1:3000/reset" },
      headers: expect.any(Headers),
    });
  });

  it("forgot-invalid rejects a bad email before the limit or the provider", async () => {
    const res = await forgot(post("/api/v1/password/forgot", { email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "VALIDATION", field: "email" });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("forgot-limit stops the 6th request from one IP and does not send", async () => {
    let count = 0;
    consumeRateLimit.mockImplementation(async (key: string, limit: { max: number; windowSeconds: number }) => {
      expect(key).toBe("password-forgot:203.0.113.8");
      expect(limit).toEqual({ max: 5, windowSeconds: 60 * 60 });
      count += 1;
      return count <= 5 ? { allowed: true } : { allowed: false, retryAfterSeconds: 125 };
    });
    for (let n = 0; n < 5; n += 1) {
      const res = await forgot(post("/api/v1/password/forgot", { email: "known@example.com" }));
      expect(res.status).toBe(200);
    }
    const limited = await forgot(post("/api/v1/password/forgot", { email: "other@example.com" }));
    const body = await limited.json();
    expect(limited.status).toBe(429);
    expect(body).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many password reset attempts",
      params: { unit: "minute", count: 3 },
    });
    expect(JSON.stringify(body)).not.toContain("other@example.com");
    expect(JSON.stringify(body)).not.toContain("known@example.com");
    expect(requestPasswordReset).toHaveBeenCalledTimes(5);
  });
});

describe("POST /api/v1/password/reset", () => {
  it("reset-ok stores the password, sets no session, and a second use is stale", async () => {
    const res = await reset(post("/api/v1/password/reset", { token: "live-token", password: "password1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("set-auth-token")).toBeNull();
    expect(await res.json()).toEqual({ ok: true, data: { saved: true } });
    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(resetPassword).toHaveBeenCalledWith({
      body: { newPassword: "password1", token: "live-token" },
    });

    resetPassword.mockRejectedValue(
      Object.assign(new Error("Invalid token"), { body: { code: "INVALID_TOKEN", message: "Invalid token" } }),
    );
    const again = await reset(post("/api/v1/password/reset", { token: "live-token", password: "password1" }));
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Reset link is stale",
      reason: "RESET_LINK_STALE",
    });
  });

  it("reset-stale maps an expired, used, or empty token", async () => {
    for (const token of ["", "   "]) {
      const res = await reset(post("/api/v1/password/reset", { token, password: "password1" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "VALIDATION", reason: "RESET_LINK_STALE" });
    }
    const missing = await reset(post("/api/v1/password/reset", { password: "password1" }));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ code: "VALIDATION", reason: "RESET_LINK_STALE" });
    expect(resetPassword).not.toHaveBeenCalled();

    for (const code of ["TOKEN_EXPIRED", "USER_NOT_FOUND"]) {
      resetPassword.mockRejectedValue(Object.assign(new Error(code), { body: { code } }));
      const expired = await reset(post("/api/v1/password/reset", { token: "old", password: "password1" }));
      expect(expired.status).toBe(400);
      expect(await expired.json()).toMatchObject({ reason: "RESET_LINK_STALE" });
    }
  });

  it("reset-short rejects a short password and leaves the token unspent", async () => {
    const res = await reset(post("/api/v1/password/reset", { token: "live-token", password: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: "VALIDATION", field: "password" });
    expect(body.reason).toBeUndefined();
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
