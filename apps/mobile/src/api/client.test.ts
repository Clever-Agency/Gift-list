import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { meSchema } from "@gift-list/contracts";
import { apiRequest, buildAcceptLanguage } from "./client";

vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "ru-BY" }, { languageTag: "en-US" }],
}));

const ME = { id: "u1", email: "a@b.c", name: "Аня", nick: "anya" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("apiRequest (web transport)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://api.example.com/");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("me-ok: returns data", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: ME }));
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({ ok: true, data: ME });
  });

  it("err-reason: returns the api error", async () => {
    const error = { ok: false, code: "VALIDATION", message: "x", reason: "EMAIL_TAKEN" };
    fetchMock.mockResolvedValue(json(error, 422));
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({ ok: false, kind: "api", error });
  });

  it("unknown-reason: keeps the known code without reason", async () => {
    fetchMock.mockResolvedValue(
      json({ ok: false, code: "UNAUTHENTICATED", message: "m", reason: "NEW_ONE", extra: 1 }, 401),
    );
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({
      ok: false,
      kind: "api",
      error: { ok: false, code: "UNAUTHENTICATED", message: "m" },
    });
  });

  it("keeps a known reason and field when an extra field fails the strict schema", async () => {
    fetchMock.mockResolvedValue(
      json({ ok: false, code: "VALIDATION", reason: "EMAIL_TAKEN", field: "email", extra: 1 }, 422),
    );
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({
      ok: false,
      kind: "api",
      error: { ok: false, code: "VALIDATION", message: "", reason: "EMAIL_TAKEN", field: "email" },
    });
  });

  it("sends method, Content-Type and JSON body; defaults to GET", async () => {
    fetchMock.mockImplementation(async () => json({ ok: true, data: ME }));
    await apiRequest("/api/v1/me", meSchema, { method: "POST", body: { a: 1 } });
    const post = fetchMock.mock.calls[0][1] as RequestInit;
    expect(post.method).toBe("POST");
    expect((post.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(post.body).toBe('{"a":1}');
    await apiRequest("/api/v1/me", meSchema);
    const get = fetchMock.mock.calls[1][1] as RequestInit;
    expect(get.method).toBe("GET");
    expect(get.body).toBeUndefined();
  });

  it("unknown code is network", async () => {
    fetchMock.mockResolvedValue(json({ ok: false, code: "WHATEVER" }, 500));
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({ ok: false, kind: "network" });
  });

  it("no-envelope: 500 HTML is network", async () => {
    fetchMock.mockResolvedValue(new Response("<html>500</html>", { status: 500 }));
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({ ok: false, kind: "network" });
  });

  it("no-envelope: JSON that is not an envelope or has bad data is network", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "boom" }, 500));
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({ ok: false, kind: "network" });
    fetchMock.mockResolvedValueOnce(json({ ok: true, data: { id: 1 } }));
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({ ok: false, kind: "network" });
  });

  it("fetch-fail: network", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await apiRequest("/api/v1/me", meSchema)).toEqual({ ok: false, kind: "network" });
  });

  it("web-headers: cookie, Accept-Language, no Authorization or expo-origin", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: ME }));
    await apiRequest("/api/auth/sign-in/email", meSchema);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/auth/sign-in/email");
    expect(init.credentials).toBe("include");
    const headers = init.headers as Record<string, string>;
    expect(headers["Accept-Language"]).toBe("ru-BY,en-US;q=0.9");
    expect(headers).not.toHaveProperty("Authorization");
    expect(headers).not.toHaveProperty("expo-origin");
  });

  it("uses a relative path when the base URL is empty", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    fetchMock.mockResolvedValue(json({ ok: true, data: ME }));
    await apiRequest("/api/v1/me", meSchema);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/me");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["Accept-Language"]).toBe("ru-BY,en-US;q=0.9");
  });
});

describe("buildAcceptLanguage", () => {
  it("lists tags with descending q", () => {
    expect(buildAcceptLanguage(["ru-BY", "en-US", "de"])).toBe("ru-BY,en-US;q=0.9,de;q=0.8");
  });

  it("falls back to the default locale", () => {
    expect(buildAcceptLanguage([])).toBe("ru");
  });
});
