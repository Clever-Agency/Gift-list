import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ prisma: {} }));

import { DEFAULT_AUTH_RATE_LIMIT, authRateLimit } from "./rate-limit";

const originalMax = process.env.AUTH_RATE_LIMIT_MAX;
const originalWindow = process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS;

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

// `authRateLimit` reads `process.env` on every call, so no module cache reset is needed.
afterEach(() => {
  restore("AUTH_RATE_LIMIT_MAX", originalMax);
  restore("AUTH_RATE_LIMIT_WINDOW_SECONDS", originalWindow);
});

describe("authRateLimit", () => {
  it("keeps the production default when both variables are unset", () => {
    delete process.env.AUTH_RATE_LIMIT_MAX;
    delete process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS;
    expect(authRateLimit()).toEqual({ max: 5, windowSeconds: 3600 });
    expect(DEFAULT_AUTH_RATE_LIMIT).toEqual({ max: 5, windowSeconds: 3600 });
  });

  it("treats a blank value as unset", () => {
    process.env.AUTH_RATE_LIMIT_MAX = "  ";
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = "";
    expect(authRateLimit()).toEqual(DEFAULT_AUTH_RATE_LIMIT);
  });

  it("reads the override from the environment", () => {
    process.env.AUTH_RATE_LIMIT_MAX = "100";
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = "60";
    expect(authRateLimit()).toEqual({ max: 100, windowSeconds: 60 });
  });

  it.each(["abc", "0", "-1", "1.5", "5 attempts"])(
    "rejects AUTH_RATE_LIMIT_MAX=%s",
    (value) => {
      process.env.AUTH_RATE_LIMIT_MAX = value;
      expect(() => authRateLimit()).toThrow(/AUTH_RATE_LIMIT_MAX/);
    },
  );

  it.each(["abc", "0", "-1", "2.5"])(
    "rejects AUTH_RATE_LIMIT_WINDOW_SECONDS=%s",
    (value) => {
      process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = value;
      expect(() => authRateLimit()).toThrow(/AUTH_RATE_LIMIT_WINDOW_SECONDS/);
    },
  );
});
