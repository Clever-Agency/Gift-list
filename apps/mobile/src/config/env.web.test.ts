// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicWebOrigin } from "@/config/env";

const happyDOM = window as unknown as { happyDOM: { setURL(url: string): void } };

beforeEach(() => {
  happyDOM.happyDOM.setURL("https://gift.example/");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * The Expo-web bundle has a page origin; native has none. These tests pin the
 * web-only last resort: a deployed SPA is served from the same domain as the
 * API (AD-26), so an empty build env still yields the public origin instead of
 * an unavailable copy-link button.
 */
describe("getPublicWebOrigin on the web", () => {
  it("uses the current page origin when the build env is empty", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");

    expect(getPublicWebOrigin()).toBe("https://gift.example");
  });

  it("keeps an explicit build origin ahead of the page origin", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://links.example/");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");

    expect(getPublicWebOrigin()).toBe("https://links.example");
  });

  it("keeps the API origin ahead of the page origin", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example/");

    expect(getPublicWebOrigin()).toBe("https://api.example");
  });

  it("does not replace an invalid explicit origin with the page origin", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");

    expect(getPublicWebOrigin()).toBe("");
  });
});
