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
});

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
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
    process.env.BETTER_AUTH_SECRET = "01234567890123456789012345678901";
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
    process.env.BRAND_NAME = "  ";
    vi.resetModules();
    const { getEnv } = await import("./env");
    expect(getEnv().BRAND_NAME).toBe("Gift List");
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;
  });
});
