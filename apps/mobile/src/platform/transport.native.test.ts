import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareRequest, readResponse, resolveUrl } from "./transport.native";

const store = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("./session-token.native", () => ({
  getSessionToken: async () => store.token,
  setSessionToken: async (token: string) => {
    store.token = token;
  },
  clearSessionToken: async () => {
    store.token = null;
  },
}));

describe("native transport", () => {
  beforeEach(() => {
    store.token = null;
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("native-headers: Bearer and expo-origin on /api/auth/*", async () => {
    store.token = "t1";
    const prepared = await prepareRequest("/api/auth/sign-in/email", { "Accept-Language": "ru" });
    expect(prepared.headers).toEqual({
      "Accept-Language": "ru",
      Authorization: "Bearer t1",
      "expo-origin": "giftlist://",
    });
    expect(prepared.credentials).toBeUndefined();
  });

  it("omits Authorization without a token and expo-origin off /api/auth", async () => {
    const prepared = await prepareRequest("/api/v1/me", {});
    expect(prepared.headers).toEqual({});
  });

  it("native-token: stores set-auth-token", async () => {
    await readResponse(
      "/api/auth/sign-in/email",
      new Response("{}", { headers: { "set-auth-token": "t2" } }),
    );
    expect(store.token).toBe("t2");
  });

  it("keeps the token when the header is absent", async () => {
    store.token = "t1";
    await readResponse("/api/v1/me", new Response("{}"));
    expect(store.token).toBe("t1");
  });

  it("empty base URL gives no URL", () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    expect(resolveUrl("/api/v1/me")).toBeNull();
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example.com/");
    expect(resolveUrl("/api/v1/me")).toBe("https://api.example.com/api/v1/me");
  });
});
