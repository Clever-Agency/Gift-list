import { describe, expect, it } from "vitest";
import {
  containsEmulatorOrigin,
  originHost,
  validateBuildOrigins,
} from "./api-origin";

describe("originHost", () => {
  it("accepts a bare http(s) origin with an optional port", () => {
    expect(originHost("http://192.168.100.2:3417")).toBe("192.168.100.2");
    expect(originHost("https://gift.example/")).toBe("gift.example");
    expect(originHost("  http://localhost:3000  ")).toBe("localhost");
  });

  it("rejects a path, another scheme and a bare hostname", () => {
    expect(originHost("http://gift.example/api")).toBeNull();
    expect(originHost("gift.example")).toBeNull();
    expect(originHost("ftp://gift.example")).toBeNull();
    expect(originHost("")).toBeNull();
  });
});

describe("validateBuildOrigins", () => {
  it("web with no configured origin is the same-origin build", () => {
    expect(validateBuildOrigins("web", {})).toEqual({ errors: [], warnings: [] });
  });

  it("web fails on the emulator origin and warns about any absolute API origin", () => {
    const emulator = validateBuildOrigins("web", {
      apiBase: "http://10.0.2.2:3417",
    });
    expect(emulator.errors.join(" ")).toContain("10.0.2.2");

    const absolute = validateBuildOrigins("web", {
      apiBase: "https://api.example",
    });
    expect(absolute.errors).toEqual([]);
    expect(absolute.warnings.join(" ")).toContain("same-origin");
  });

  it("web fails when a share-link origin is the emulator alias", () => {
    const check = validateBuildOrigins("web", {
      webOrigin: "http://10.0.2.2:3000",
    });
    expect(check.errors.join(" ")).toContain("10.0.2.2");
  });

  it("LAN requires an explicit reachable origin", () => {
    expect(validateBuildOrigins("lan", {}).errors.join(" ")).toContain(
      "EXPO_PUBLIC_API_BASE_URL is required",
    );
    expect(validateBuildOrigins("lan", { apiBase: "http://192.168.100.2:3417" })).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("LAN rejects the emulator alias and loopback", () => {
    expect(
      validateBuildOrigins("lan", { apiBase: "http://10.0.2.2:3417" }).errors.join(" "),
    ).toContain("10.0.2.2");
    expect(
      validateBuildOrigins("lan", { apiBase: "http://localhost:3000" }).errors.join(" "),
    ).toContain("loopback");
    expect(
      validateBuildOrigins("lan", { apiBase: "http://127.0.0.1:3000" }).errors.join(" "),
    ).toContain("loopback");
    expect(
      validateBuildOrigins("lan", {
        apiBase: "http://192.168.100.2:3417",
        webOrigin: "http://localhost:3000",
      }).errors.join(" "),
    ).toContain("localhost");
  });

  it("the emulator build accepts the emulator origin", () => {
    expect(
      validateBuildOrigins("emulator", { apiBase: "http://10.0.2.2:3417" }),
    ).toEqual({ errors: [], warnings: [] });
  });

  it("rejects a value that is not an origin", () => {
    expect(
      validateBuildOrigins("web", { apiBase: "http://gift.example/api" }).errors.join(" "),
    ).toContain("without a path");
  });
});

describe("containsEmulatorOrigin", () => {
  it("finds the baked host in a bundle", () => {
    expect(containsEmulatorOrigin('var a="http://10.0.2.2:3417";')).toBe(true);
    expect(containsEmulatorOrigin("fetch(`http://10.0.2.2:3417/api/v1/me`)")).toBe(true);
  });

  it("does not match a longer address", () => {
    expect(containsEmulatorOrigin("http://110.0.2.23:3417")).toBe(false);
    expect(containsEmulatorOrigin("http://192.168.100.2:3417")).toBe(false);
  });
});
