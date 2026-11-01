import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { meSchema } from "@gift-list/contracts";
import { apiRequest } from "./client";

const store = vi.hoisted(() => ({ token: null as string | null, readFails: false }));

vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "ru-BY" }] }));
vi.mock("@/platform/transport", () => import("@/platform/transport.native"));
vi.mock("@/platform/session-token.native", () => ({
  getSessionToken: async () => {
    if (store.readFails) throw new Error("keystore");
    return store.token;
  },
  setSessionToken: async (token: string) => {
    store.token = token;
  },
  clearSessionToken: async () => {
    store.token = null;
  },
}));

const ME = { id: "u1", email: "a@b.c", name: "Аня", nick: "anya" };

describe("apiRequest (native transport)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    store.token = null;
    store.readFails = false;
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example.com");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true, data: ME }), {
          headers: { "set-auth-token": "t2" },
        }),
    );
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends Bearer and expo-origin on /api/auth/*", async () => {
    store.token = "t1";
    await apiRequest("/api/auth/sign-in/email", meSchema);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer t1");
    expect(headers["expo-origin"]).toBe("giftlist://");
    expect(init.credentials).toBeUndefined();
  });

  it("stores set-auth-token", async () => {
    await apiRequest("/api/auth/sign-in/email", meSchema);
    expect(store.token).toBe("t2");
  });

  it("empty base URL is network without fetch", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({ ok: false, kind: "network" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("store-read-fail: network without fetch", async () => {
    store.readFails = true;
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({ ok: false, kind: "network" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
