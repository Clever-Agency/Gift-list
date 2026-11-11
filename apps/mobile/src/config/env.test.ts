import { PRODUCT_NAME } from "@gift-list/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBrandName,
  getPublicWebOrigin,
  normalizeWebOrigin,
  resolvePublicWebOrigin,
} from "@/config/env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getBrandName", () => {
  it("falls back to PRODUCT_NAME when EXPO_PUBLIC_BRAND_NAME is unset or blank", () => {
    vi.stubEnv("EXPO_PUBLIC_BRAND_NAME", "");
    expect(getBrandName()).toBe(PRODUCT_NAME);
    vi.stubEnv("EXPO_PUBLIC_BRAND_NAME", "   ");
    expect(getBrandName()).toBe(PRODUCT_NAME);
  });

  it("reads EXPO_PUBLIC_BRAND_NAME when it is set", () => {
    vi.stubEnv("EXPO_PUBLIC_BRAND_NAME", " Paper ");
    expect(getBrandName()).toBe("Paper");
  });
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

  it("rejects userinfo so a share link cannot point at another host", () => {
    expect(normalizeWebOrigin("https://gift.example@evil.com")).toBe("");
    expect(normalizeWebOrigin("https://user:pass@gift.example")).toBe("");
    expect(normalizeWebOrigin("https://user@gift.example")).toBe("");
    expect(normalizeWebOrigin("https://@gift.example")).toBe("");
  });

  it("rejects a backslash that changes how the authority is parsed", () => {
    expect(normalizeWebOrigin("https://evil.com\\@gift.example")).toBe("");
    expect(normalizeWebOrigin("https://evil.com\\gift.example")).toBe("");
    expect(normalizeWebOrigin("https:/\\gift.example")).toBe("");
  });

  it("accepts localhost and IPv6 hosts with a numeric port", () => {
    expect(normalizeWebOrigin("http://localhost/")).toBe("http://localhost");
    expect(normalizeWebOrigin("http://[::1]:3000")).toBe("http://[::1]:3000");
    expect(normalizeWebOrigin("https://[2001:db8::1]")).toBe("https://[2001:db8::1]");
  });

  it("rejects a malformed or out-of-range port", () => {
    expect(normalizeWebOrigin("https://gift.example:abc")).toBe("");
    expect(normalizeWebOrigin("https://gift.example:")).toBe("");
    expect(normalizeWebOrigin("https://gift.example:65536")).toBe("");
    expect(normalizeWebOrigin("https://gift.example:0")).toBe("");
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
    expect(resolvePublicWebOrigin(undefined, undefined, "")).toBe("");
  });

  it("treats a whitespace public origin as empty", () => {
    expect(resolvePublicWebOrigin("   ", "", "https://gift.example")).toBe("https://gift.example");
    expect(resolvePublicWebOrigin("   ", "   ", "https://gift.example")).toBe(
      "https://gift.example",
    );
  });

  it("does not fall back when an explicit value is set but invalid", () => {
    expect(resolvePublicWebOrigin("gift.example", "https://gift.example")).toBe("");
    expect(resolvePublicWebOrigin("https://gift.example/app", "https://gift.example")).toBe("");
  });

  it("does not fall back when an explicit value carries userinfo or a backslash", () => {
    expect(
      resolvePublicWebOrigin("https://gift.example@evil.com", "https://gift.example"),
    ).toBe("");
    expect(
      resolvePublicWebOrigin(
        "https://user:pass@gift.example",
        "",
        "https://preview.example",
      ),
    ).toBe("");
    expect(
      resolvePublicWebOrigin("https://evil.com\\@gift.example", "https://gift.example"),
    ).toBe("");
  });

  it("does not fall back when a set API origin is invalid", () => {
    expect(resolvePublicWebOrigin("", "https://api.example/v1", "https://gift.example")).toBe("");
  });

  it("uses the page origin on the web when both variables are empty", () => {
    expect(resolvePublicWebOrigin("", "", "https://gift.example")).toBe("https://gift.example");
    expect(resolvePublicWebOrigin(undefined, undefined, "https://gift.example/")).toBe(
      "https://gift.example",
    );
  });

  it("keeps the configured origin ahead of the page origin", () => {
    expect(
      resolvePublicWebOrigin("https://gift.example", "", "https://preview.example"),
    ).toBe("https://gift.example");
    expect(
      resolvePublicWebOrigin("", "https://api.example", "https://preview.example"),
    ).toBe("https://api.example");
  });

  it("rejects an invalid page origin instead of using it", () => {
    expect(resolvePublicWebOrigin("", "", "gift.example")).toBe("");
    expect(resolvePublicWebOrigin("", "", "null")).toBe("");
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

  it("returns empty when neither variable is set and there is no page origin (native/node)", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    expect(getPublicWebOrigin()).toBe("");
  });

  it("ignores a window without a location (native shape)", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    vi.stubGlobal("window", {});
    expect(getPublicWebOrigin()).toBe("");
  });
});
