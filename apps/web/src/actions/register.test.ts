import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findFirst, create, signInEmail } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  signInEmail: vi.fn(),
}));

vi.mock("@/db/client", () => ({ prisma: { user: { findFirst, create } } }));
vi.mock("@/db/generated/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { signInEmail } } }));
vi.mock("@/lib/rate-limit", () => ({
  REGISTER_LIMIT: { max: 5, windowSeconds: 3600 },
  consumeRateLimit: async () => ({ allowed: true }),
  clientIp: () => "127.0.0.1",
}));

import { registerUser } from "./register";

const input = {
  email: "a@example.com",
  password: "password1",
  displayName: "Анна",
  nick: "anna",
};

function headers(language = "ru-BY") {
  return new Headers({ "accept-language": language });
}

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
  signInEmail.mockReset();
  findFirst.mockResolvedValue(null);
  create.mockResolvedValue({});
  signInEmail.mockResolvedValue(new Response(null, { status: 200 }));
});

describe("registerUser", () => {
  it("creates one list without a type and stores the negotiated locale", async () => {
    const outcome = await registerUser(input, headers());
    expect(outcome.result).toMatchObject({
      ok: true,
      data: {
        user: { email: "a@example.com", name: "Анна", nick: "anna", timeZone: null },
        next: "/",
      },
    });
    const data = create.mock.calls[0]?.[0].data;
    expect(data.locale).toBe("ru");
    expect(data.lists.create).toEqual({ publicToken: expect.any(String) });
    expect(data.lists.create).not.toHaveProperty("type");
    expect(data.accounts.create.accountId).toBe(data.id);
    expect(outcome.session).toBeInstanceOf(Response);
  });

  it("falls back to ru when Accept-Language has no supported tag", async () => {
    await registerUser(input, headers("en-US"));
    expect(create.mock.calls[0]?.[0].data.locale).toBe("ru");
  });

  it("rewrites a list link and drops an absolute next", async () => {
    const list = await registerUser({ ...input, next: "/l/tok_1" }, headers());
    expect(list.result).toMatchObject({ ok: true, data: { next: "/wishlist/tok_1" } });
    const external = await registerUser({ ...input, next: "https://evil.test" }, headers());
    expect(external.result).toMatchObject({ ok: true, data: { next: "/" } });
  });

  it("maps a duplicate email to EMAIL_TAKEN, including when the nick is taken too", async () => {
    findFirst.mockResolvedValue({ email: "a@example.com", nickNormalized: "anna" });
    expect((await registerUser(input, headers())).result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "EMAIL_TAKEN",
      field: "email",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a duplicate nick to NICK_TAKEN", async () => {
    findFirst.mockResolvedValue({ email: "b@example.com", nickNormalized: "anna" });
    expect((await registerUser(input, headers())).result).toMatchObject({
      reason: "NICK_TAKEN",
      field: "nick",
    });
  });

  it("does not open a session when sign-in fails", async () => {
    signInEmail.mockResolvedValue(new Response(null, { status: 401 }));
    const outcome = await registerUser(input, headers());
    expect(outcome.result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(outcome.session).toBeUndefined();
  });
});
