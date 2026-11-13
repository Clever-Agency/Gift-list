import { PRODUCT_NAME } from "@gift-list/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrandName } from "./env";

const originalBrand = process.env.BRAND_NAME;
const originalDatabase = process.env.DATABASE_URL;

afterEach(() => {
  if (originalBrand === undefined) delete process.env.BRAND_NAME;
  else process.env.BRAND_NAME = originalBrand;
  if (originalDatabase === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabase;
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.APPLE_TEAM_ID;
  delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
  delete process.env.AUTH_DEV_TRUSTED_ORIGINS;
  delete process.env.AUTH_RATE_LIMIT_MAX;
  delete process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS;
});

function setRequiredEnv() {
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = "01234567890123456789012345678901";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "noreply@example.com";
}

describe("getBrandName", () => {
  it("defaults to PRODUCT_NAME without DATABASE_URL", () => {
    delete process.env.BRAND_NAME;
    delete process.env.DATABASE_URL;
    expect(getBrandName()).toBe(PRODUCT_NAME);
  });

  it("reads BRAND_NAME from the environment", () => {
    process.env.BRAND_NAME = "Paper";
    expect(getBrandName()).toBe("Paper");
  });

  it("treats a blank BRAND_NAME as unset", () => {
    process.env.BRAND_NAME = "  ";
    expect(getBrandName()).toBe(PRODUCT_NAME);
  });

  it("getEnv uses the same blank-name default without failing the rest of the schema", async () => {
    setRequiredEnv();
    process.env.BRAND_NAME = "  ";
    vi.resetModules();
    const { getEnv } = await import("./env");
    expect(getEnv().BRAND_NAME).toBe(PRODUCT_NAME);
  });
});

describe("mail and app-link env", () => {
  it("accepts an address or a named address and ignores blank link ids", async () => {
    setRequiredEnv();
    process.env.EMAIL_FROM = "Имя <noreply@example.com>";
    process.env.APPLE_TEAM_ID = "  ";
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = "";
    vi.resetModules();
    const { getEnv } = await import("./env");
    expect(getEnv().EMAIL_FROM).toBe("Имя <noreply@example.com>");
    expect(getEnv().APPLE_TEAM_ID).toBeUndefined();
    expect(getEnv().ANDROID_SHA256_CERT_FINGERPRINTS).toBeUndefined();
  });

  it("keeps a comma-separated fingerprint list", async () => {
    setRequiredEnv();
    process.env.APPLE_TEAM_ID = "AB12CD34EF";
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = "AA:BB, CC:DD";
    vi.resetModules();
    const { getEnv } = await import("./env");
    expect(getEnv().APPLE_TEAM_ID).toBe("AB12CD34EF");
    expect(getEnv().ANDROID_SHA256_CERT_FINGERPRINTS).toBe("AA:BB, CC:DD");
  });

  it("parses when Resend is unset so sign-in does not depend on it", async () => {
    setRequiredEnv();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.resetModules();
    const { getEnv } = await import("./env");
    expect(getEnv().RESEND_API_KEY).toBeUndefined();
    expect(getEnv().EMAIL_FROM).toBeUndefined();
  });

  it("rejects an EMAIL_FROM that is neither an address nor Name <address>", async () => {
    setRequiredEnv();
    process.env.EMAIL_FROM = "not an email";
    vi.resetModules();
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow();
  });
});

describe("AUTH_DEV_TRUSTED_ORIGINS", () => {
  async function loadEnv() {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
    process.env.BETTER_AUTH_SECRET = "01234567890123456789012345678901";
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
    vi.resetModules();
    const { getEnv } = await import("./env");
    return getEnv();
  }

  it("is an empty list when unset", async () => {
    delete process.env.AUTH_DEV_TRUSTED_ORIGINS;
    expect((await loadEnv()).AUTH_DEV_TRUSTED_ORIGINS).toEqual([]);
  });

  it("splits on commas, trims and drops empty items", async () => {
    process.env.AUTH_DEV_TRUSTED_ORIGINS = "exp://, ,exp+giftlist://";
    expect((await loadEnv()).AUTH_DEV_TRUSTED_ORIGINS).toEqual(["exp://", "exp+giftlist://"]);
  });

  it("is an empty list for an empty string", async () => {
    process.env.AUTH_DEV_TRUSTED_ORIGINS = "";
    expect((await loadEnv()).AUTH_DEV_TRUSTED_ORIGINS).toEqual([]);
  });
});

describe("BETTER_AUTH_URL fallback on Vercel Preview", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalVercelBranchUrl = process.env.VERCEL_BRANCH_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  function restore(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  afterEach(() => {
    restore("VERCEL_ENV", originalVercelEnv);
    restore("VERCEL_BRANCH_URL", originalVercelBranchUrl);
    restore("VERCEL_URL", originalVercelUrl);
  });

  async function loadEnv() {
    vi.resetModules();
    const { getEnv } = await import("./env");
    return getEnv();
  }

  it("uses VERCEL_BRANCH_URL on preview, even when VERCEL_URL is also set", async () => {
    setRequiredEnv();
    delete process.env.BETTER_AUTH_URL;
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_BRANCH_URL = "gift-list-git-staging.vercel.app";
    process.env.VERCEL_URL = "gift-list-abc123.vercel.app";
    expect((await loadEnv()).BETTER_AUTH_URL).toBe("https://gift-list-git-staging.vercel.app");
  });

  it("falls back to VERCEL_URL on preview when the branch URL is unset", async () => {
    setRequiredEnv();
    delete process.env.BETTER_AUTH_URL;
    process.env.VERCEL_ENV = "preview";
    delete process.env.VERCEL_BRANCH_URL;
    process.env.VERCEL_URL = "gift-list-abc123.vercel.app";
    expect((await loadEnv()).BETTER_AUTH_URL).toBe("https://gift-list-abc123.vercel.app");
  });

  it("keeps an explicit BETTER_AUTH_URL on preview and ignores the host vars", async () => {
    setRequiredEnv();
    process.env.BETTER_AUTH_URL = "https://staging.wishmoon.clever-agency.dev";
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_BRANCH_URL = "gift-list-git-staging.vercel.app";
    process.env.VERCEL_URL = "gift-list-abc123.vercel.app";
    expect((await loadEnv()).BETTER_AUTH_URL).toBe("https://staging.wishmoon.clever-agency.dev");
  });

  it("treats a blank BETTER_AUTH_URL as unset on preview and falls back", async () => {
    setRequiredEnv();
    process.env.BETTER_AUTH_URL = "   ";
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_BRANCH_URL = "  ";
    process.env.VERCEL_URL = "gift-list-abc123.vercel.app";
    expect((await loadEnv()).BETTER_AUTH_URL).toBe("https://gift-list-abc123.vercel.app");
  });

  it("fails on preview when neither Vercel host is set", async () => {
    setRequiredEnv();
    delete process.env.BETTER_AUTH_URL;
    process.env.VERCEL_ENV = "preview";
    delete process.env.VERCEL_BRANCH_URL;
    delete process.env.VERCEL_URL;
    await expect(loadEnv()).rejects.toThrow(/BETTER_AUTH_URL/);
  });

  it("does not fall back to VERCEL_URL in production", async () => {
    setRequiredEnv();
    delete process.env.BETTER_AUTH_URL;
    process.env.VERCEL_ENV = "production";
    delete process.env.VERCEL_BRANCH_URL;
    process.env.VERCEL_URL = "gift-list-abc123.vercel.app";
    await expect(loadEnv()).rejects.toThrow(/BETTER_AUTH_URL/);
  });

  it("requires BETTER_AUTH_URL locally", async () => {
    setRequiredEnv();
    delete process.env.BETTER_AUTH_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_BRANCH_URL;
    process.env.VERCEL_URL = "gift-list-abc123.vercel.app";
    await expect(loadEnv()).rejects.toThrow(/BETTER_AUTH_URL/);
  });
});

describe("AUTH_RATE_LIMIT_*", () => {
  async function loadEnv() {
    setRequiredEnv();
    vi.resetModules();
    const { getEnv } = await import("./env");
    return getEnv();
  }

  it("defaults to five attempts per hour", async () => {
    delete process.env.AUTH_RATE_LIMIT_MAX;
    delete process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS;
    const env = await loadEnv();
    expect(env.AUTH_RATE_LIMIT_MAX).toBe(5);
    expect(env.AUTH_RATE_LIMIT_WINDOW_SECONDS).toBe(3600);
  });

  it("reads overrides and ignores blanks", async () => {
    process.env.AUTH_RATE_LIMIT_MAX = "100";
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = " ";
    const env = await loadEnv();
    expect(env.AUTH_RATE_LIMIT_MAX).toBe(100);
    expect(env.AUTH_RATE_LIMIT_WINDOW_SECONDS).toBe(3600);
  });

  it.each(["abc", "0", "-1", "1.5"])("rejects %s as a limit value", async (value) => {
    process.env.AUTH_RATE_LIMIT_MAX = value;
    vi.resetModules();
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(/AUTH_RATE_LIMIT_MAX/);
  });
});
