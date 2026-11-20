import { beforeEach, describe, expect, it } from "vitest";

import { cronAuthorized } from "./cron-auth";

const secret = "01234567890123456789012345678901";

function request(authorization?: string): Request {
  return new Request("http://localhost/api/cron/reservation-timers", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = secret;
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = secret;
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
});

describe("cronAuthorized", () => {
  it("accepts the bearer the scheduler sends", () => {
    expect(cronAuthorized(request(`Bearer ${secret}`))).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(cronAuthorized(request())).toBe(false);
  });

  it("rejects a wrong secret of the same length", () => {
    expect(cronAuthorized(request(`Bearer ${"x".repeat(secret.length)}`))).toBe(false);
  });

  /** A short or empty value must not throw: both sides are hashed before comparing. */
  it("rejects a wrong-length or empty secret without throwing", () => {
    expect(() => cronAuthorized(request("Bearer short"))).not.toThrow();
    expect(cronAuthorized(request("Bearer short"))).toBe(false);
    expect(cronAuthorized(request("Bearer "))).toBe(false);
  });

  it("rejects a secret without the bearer prefix", () => {
    expect(cronAuthorized(request(secret))).toBe(false);
  });
});
