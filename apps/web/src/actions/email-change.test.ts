import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  changeEmail,
  findUnique,
  consumeRateLimit,
  rememberEmailChangeRequest,
  forgetEmailChangeRequest,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  changeEmail: vi.fn(),
  findUnique: vi.fn(),
  consumeRateLimit: vi.fn(),
  rememberEmailChangeRequest: vi.fn(),
  forgetEmailChangeRequest: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession, changeEmail } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique } } }));
vi.mock("@/lib/rate-limit", () => ({
  authRateLimit: () => ({ max: 5, windowSeconds: 3600 }),
  consumeRateLimit,
}));
vi.mock("@/lib/email-change-pending", () => ({
  forgetEmailChangeRequest,
  rememberEmailChangeRequest,
}));

import { cancelEmailChange, requestEmailChange } from "./email-change";

const headers = new Headers({ cookie: "better-auth.session_token=t" });

const row = { id: "u1", email: "old@example.com", locale: "ru" };

beforeEach(() => {
  getSession.mockReset();
  changeEmail.mockReset();
  findUnique.mockReset();
  consumeRateLimit.mockReset();
  rememberEmailChangeRequest.mockReset();
  forgetEmailChangeRequest.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue(row);
  consumeRateLimit.mockResolvedValue({ allowed: true });
  rememberEmailChangeRequest.mockResolvedValue(undefined);
  forgetEmailChangeRequest.mockResolvedValue(undefined);
  changeEmail.mockResolvedValue({ status: true });
});

describe("requestEmailChange", () => {
  it("requires a session before the rate limit or the database", async () => {
    getSession.mockResolvedValue(null);

    expect(await requestEmailChange({ email: "new@example.com" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(changeEmail).not.toHaveBeenCalled();
  });

  it("limits the requests per user with the same numbers as auth", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 900 });

    const result = await requestEmailChange({ email: "new@example.com" }, headers);

    expect(consumeRateLimit).toHaveBeenCalledWith("email-change:u1", { max: 5, windowSeconds: 3600 });
    expect(result).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many email change attempts",
      params: { unit: "minute", count: 15 },
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(changeEmail).not.toHaveBeenCalled();
  });

  it("answers UNAUTHENTICATED when the user row is gone", async () => {
    findUnique.mockResolvedValue(null);

    expect(await requestEmailChange({ email: "new@example.com" }, headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(changeEmail).not.toHaveBeenCalled();
  });

  it("sends the link through Better Auth and remembers the address being left", async () => {
    expect(await requestEmailChange({ email: "New@Example.com" }, headers)).toEqual({
      ok: true,
      data: { accepted: true },
    });

    expect(rememberEmailChangeRequest).toHaveBeenCalledWith({
      userId: "u1",
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      locale: "ru",
    });
    expect(changeEmail).toHaveBeenCalledWith({
      body: { newEmail: "new@example.com", callbackURL: "/profile?emailChanged=1" },
      headers,
    });
  });

  it("keeps the same answer for the address the account already has", async () => {
    expect(await requestEmailChange({ email: "OLD@example.com" }, headers)).toEqual({
      ok: true,
      data: { accepted: true },
    });
    expect(rememberEmailChangeRequest).not.toHaveBeenCalled();
    expect(changeEmail).not.toHaveBeenCalled();
  });

  it("does not reveal a taken address: the answer matches a free one", async () => {
    // Better Auth answers a taken address with the same neutral `status: true`
    // and sends no letter, so the use-case has nothing to distinguish.
    const taken = await requestEmailChange({ email: "taken@example.com" }, headers);
    const free = await requestEmailChange({ email: "free@example.com" }, headers);

    expect(taken).toEqual(free);
    expect(taken).toEqual({ ok: true, data: { accepted: true } });
  });
});

describe("cancelEmailChange", () => {
  it("requires a session before forgetting anything", async () => {
    getSession.mockResolvedValue(null);

    expect(await cancelEmailChange(headers)).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(forgetEmailChangeRequest).not.toHaveBeenCalled();
  });

  it("drops the pending wish of the signed-in user", async () => {
    expect(await cancelEmailChange(headers)).toEqual({
      ok: true,
      data: { cancelled: true },
    });
    expect(forgetEmailChangeRequest).toHaveBeenCalledWith("u1");
    expect(changeEmail).not.toHaveBeenCalled();
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });
});
