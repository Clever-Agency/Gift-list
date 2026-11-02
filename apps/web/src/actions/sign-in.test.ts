import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findUnique, signInEmail, consumeRateLimit } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  signInEmail: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/db/client", () => ({ prisma: { user: { findUnique } } }));
vi.mock("@/lib/auth", () => ({ auth: { api: { signInEmail } } }));
vi.mock("@/lib/rate-limit", () => ({
  REGISTER_LIMIT: { max: 5, windowSeconds: 60 * 60 },
  consumeRateLimit,
  clientIp: () => "203.0.113.8",
}));

import { signInUser } from "./sign-in";

const input = { email: "a@example.com", password: "password1", next: "/l/tok_1" };
const headers = new Headers();

beforeEach(() => {
  findUnique.mockReset();
  signInEmail.mockReset();
  consumeRateLimit.mockReset();
  consumeRateLimit.mockResolvedValue({ allowed: true });
});

describe("signInUser", () => {
  it("returns the user and a rewritten next path", async () => {
    signInEmail.mockResolvedValue(new Response(null, { status: 200 }));
    findUnique.mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      name: "Анна",
      nick: "anna",
      timeZone: "Europe/Minsk",
    });
    const outcome = await signInUser(input, headers);
    expect(outcome.result).toEqual({
      ok: true,
      data: {
        user: {
          id: "u1",
          email: "a@example.com",
          name: "Анна",
          nick: "anna",
          timeZone: "Europe/Minsk",
        },
        next: "/wishlist/tok_1",
      },
    });
    expect(outcome.session?.status).toBe(200);
  });

  it("returns the same body for an unknown email and a wrong password", async () => {
    signInEmail.mockResolvedValueOnce(
      Response.json({ message: "User not found" }, { status: 401 }),
    );
    const unknown = await signInUser(input, headers);
    signInEmail.mockResolvedValueOnce(
      Response.json({ message: "Invalid password" }, { status: 401 }),
    );
    const wrong = await signInUser(input, headers);
    expect(unknown.result).toEqual(wrong.result);
    expect(unknown.result).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Invalid email or password",
    });
    expect(JSON.stringify(unknown.result)).not.toContain("User not found");
    expect(JSON.stringify(wrong.result)).not.toContain("Invalid password");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns the same RATE_LIMITED body for any email and does not check the password", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 125 });
    const known = await signInUser(input, headers);
    const unknown = await signInUser(
      { ...input, email: "missing@example.com" },
      headers,
    );
    expect(known.result).toEqual(unknown.result);
    expect(known.result).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many sign-in attempts",
      params: { unit: "minute", count: 3 },
    });
    expect(JSON.stringify(known.result)).not.toContain("example.com");
    expect(signInEmail).not.toHaveBeenCalled();
  });
});
