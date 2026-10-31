import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const secret = "01234567890123456789012345678901";

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete process.env.BRAND_NAME;
});

describe("auth proxy", () => {
  it("exposes handler to toNextJsHandler's `in` check", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
    process.env.BETTER_AUTH_SECRET = secret;
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
    delete process.env.BRAND_NAME;
    vi.resetModules();
    const { auth } = await import("@/lib/auth");
    expect("handler" in auth).toBe(true);
    expect(typeof auth.handler).toBe("function");
  });

  it("registers expo, bearer and nextCookies (last) and trusts the app scheme", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
    process.env.BETTER_AUTH_SECRET = secret;
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
    vi.resetModules();
    const { auth } = await import("@/lib/auth");
    const ids = (auth.options.plugins ?? []).map((plugin) => plugin.id);
    expect(ids).toContain("expo");
    expect(ids).toContain("bearer");
    expect(ids.at(-1)).toBe("next-cookies");
    expect(auth.options.trustedOrigins).toContain("giftlist://");
  });
});
