import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPublicWebOrigin,
  normalizeWebOrigin,
  resolvePublicWebOrigin,
} from "@/config/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeWebOrigin", () => {
  it("trims whitespace and trailing slashes", () => {
    expect(normalizeWebOrigin("  https://gift.example/  ")).toBe("https://gift.example");
    expect(normalizeWebOrigin("https://gift.example///")).toBe("https://gift.example");
    expect(normalizeWebOrigin("http://10.0.2.2:3000/")).toBe("http://10.0.2.2:3000");
  });

  it("keeps a port and scheme", () => {
    expect(normalizeWebOrigin("https://gift.example:8443")).toBe("https://gift.example:8443");
    expect(normalizeWebOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("returns empty for a missing or non-origin value", () => {
    expect(normalizeWebOrigin(undefined)).toBe("");
    expect(normalizeWebOrigin("   ")).toBe("");
    expect(normalizeWebOrigin("gift.example")).toBe("");
    expect(normalizeWebOrigin("giftlist://app")).toBe("");
    expect(normalizeWebOrigin("ftp://gift.example")).toBe("");
    expect(normalizeWebOrigin("https://")).toBe("");
  });

  it("rejects a path, query or fragment instead of silently dropping it", () => {
    expect(normalizeWebOrigin("https://gift.example/link")).toBe("");
    expect(normalizeWebOrigin("https://gift.example/?from=mail")).toBe("");
    expect(normalizeWebOrigin("https://gift.example/#top")).toBe("");
  });
});

describe("resolvePublicWebOrigin", () => {
  it("prefers the explicit public origin", () => {
    expect(
      resolvePublicWebOrigin("https://gift.example/", "https://api.example"),
    ).toBe("https://gift.example");
  });

  it("falls back to the API origin when the public origin is empty", () => {
    expect(resolvePublicWebOrigin("", "https://gift.example/")).toBe("https://gift.example");
    expect(resolvePublicWebOrigin("   ", "http://10.0.2.2:3000")).toBe("http://10.0.2.2:3000");
    expect(resolvePublicWebOrigin(undefined, undefined)).toBe("");
  });

  it("does not fall back when an explicit value is set but invalid", () => {
    expect(resolvePublicWebOrigin("gift.example", "https://gift.example")).toBe("");
    expect(resolvePublicWebOrigin("https://gift.example/app", "https://gift.example")).toBe("");
  });
});

describe("getPublicWebOrigin", () => {
  it("reads EXPO_PUBLIC_WEB_ORIGIN", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", " https://gift.example/ ");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example");
    expect(getPublicWebOrigin()).toBe("https://gift.example");
  });

  it("uses EXPO_PUBLIC_API_BASE_URL when the public origin is not set", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "http://localhost:3000/");
    expect(getPublicWebOrigin()).toBe("http://localhost:3000");
  });

  it("returns empty when neither variable is set", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    expect(getPublicWebOrigin()).toBe("");
  });
});
