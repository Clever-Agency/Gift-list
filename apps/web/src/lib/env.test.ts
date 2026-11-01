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
});

function setRequiredEnv() {
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = "01234567890123456789012345678901";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "noreply@example.com";
}

describe("getBrandName", () => {
  it("defaults to Gift List without DATABASE_URL", () => {
    delete process.env.BRAND_NAME;
    delete process.env.DATABASE_URL;
    expect(getBrandName()).toBe("Gift List");
  });

  it("reads BRAND_NAME from the environment", () => {
    process.env.BRAND_NAME = "Paper";
    expect(getBrandName()).toBe("Paper");
  });

  it("treats a blank BRAND_NAME as unset", () => {
    process.env.BRAND_NAME = "  ";
    expect(getBrandName()).toBe("Gift List");
  });

  it("getEnv uses the same blank-name default without failing the rest of the schema", async () => {
    setRequiredEnv();
    process.env.BRAND_NAME = "  ";
    vi.resetModules();
    const { getEnv } = await import("./env");
    expect(getEnv().BRAND_NAME).toBe("Gift List");
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
