import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/db/client", () => ({ prisma: { user: { findFirst, create: vi.fn() } } }));
vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError: class {} } }));
vi.mock("@/lib/auth", () => ({ auth: { api: { signInEmail: vi.fn() } } }));
vi.mock("@/lib/rate-limit", () => ({
  REGISTER_LIMIT: {},
  consumeRateLimit: async () => true,
  getClientIp: async () => "127.0.0.1",
}));

import { register } from "./register";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valid = { email: "a@example.com", password: "password1", displayName: "Анна", nick: "anna" };

beforeEach(() => findFirst.mockReset());

describe("register", () => {
  it("reports the first failing field of the schema", async () => {
    const result = await register(null, form({ ...valid, email: "nope" }));
    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "email" });
    expect(result).not.toHaveProperty("reason");
  });

  it("maps a duplicate email to EMAIL_TAKEN", async () => {
    findFirst.mockResolvedValue({ email: "a@example.com", nickNormalized: "other" });
    expect(await register(null, form(valid))).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "EMAIL_TAKEN",
      field: "email",
    });
  });

  it("maps a duplicate nick to NICK_TAKEN", async () => {
    findFirst.mockResolvedValue({ email: "b@example.com", nickNormalized: "anna" });
    expect(await register(null, form(valid))).toMatchObject({
      reason: "NICK_TAKEN",
      field: "nick",
    });
  });

  it("reports the email when both are taken", async () => {
    findFirst.mockResolvedValue({ email: "a@example.com", nickNormalized: "anna" });
    expect(await register(null, form(valid))).toMatchObject({
      reason: "EMAIL_TAKEN",
      field: "email",
    });
  });
});
