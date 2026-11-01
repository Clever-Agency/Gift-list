import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./client";

const rn = vi.hoisted(() => ({ OS: "web" }));
const store = vi.hoisted(() => ({
  readSessionToken: vi.fn(),
  writeSessionToken: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return rn.OS;
    },
  },
}));
vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "ru-RU" }],
}));
vi.mock("@/platform/session-token", () => store);
vi.mock("@/config/env", () => ({ getApiBaseUrl: () => "https://api.test/" }));

function respond(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

const fetchMock = vi.fn();

function sentHeaders(): Headers {
  return (fetchMock.mock.calls[0]![1] as RequestInit).headers as Headers;
}

beforeEach(() => {
  rn.OS = "web";
  fetchMock.mockReset();
  store.readSessionToken.mockReset();
  store.writeSessionToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("apiRequest envelope", () => {
  it("returns ok data", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: 1 } }));
    expect(await apiRequest("/api/v1/me")).toEqual({
      ok: true,
      data: { id: 1 },
    });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.test/api/v1/me");
  });

  it("keeps a known reason and field", async () => {
    fetchMock.mockResolvedValue(
      respond({
        ok: false,
        code: "CONFLICT",
        message: "m",
        reason: "EMAIL_TAKEN",
        field: "email",
      }),
    );
    expect(await apiRequest("/x")).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "m",
      reason: "EMAIL_TAKEN",
      field: "email",
    });
  });

  it("drops unknown reason and extra fields", async () => {
    fetchMock.mockResolvedValue(
      respond({
        ok: false,
        code: "VALIDATION",
        message: "m",
        reason: "NOPE",
        stack: "boom",
      }),
    );
    expect(await apiRequest("/x")).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "m",
    });
  });

  it("treats an unknown code as a network failure", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "WHATEVER", message: "m" }),
    );
    expect(await apiRequest("/x")).toEqual({ ok: false, network: true });
  });

  it("treats HTML 500 and bodies without an envelope as network", async () => {
    fetchMock.mockResolvedValue(respond("<html>err</html>", { status: 500 }));
    expect(await apiRequest("/x")).toEqual({ ok: false, network: true });
    fetchMock.mockResolvedValue(respond({ hello: "world" }));
    expect(await apiRequest("/x")).toEqual({ ok: false, network: true });
  });

  it("treats a thrown fetch as network", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await apiRequest("/x")).toEqual({ ok: false, network: true });
  });
});

describe("apiRequest envelope details", () => {
  it("keeps valid params and drops invalid ones", async () => {
    fetchMock.mockResolvedValue(
      respond({
        ok: false,
        code: "VALIDATION",
        message: "m",
        params: { min: 3, a: "b" },
      }),
    );
    expect(await apiRequest("/x")).toMatchObject({
      params: { min: 3, a: "b" },
    });
    fetchMock.mockResolvedValue(
      respond({
        ok: false,
        code: "VALIDATION",
        message: "m",
        params: { x: {} },
      }),
    );
    expect(await apiRequest("/x")).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "m",
    });
  });

  it("drops a non-string field", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "VALIDATION", message: "m", field: 5 }),
    );
    expect(await apiRequest("/x")).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "m",
    });
  });

  it("treats ok:true without data as network", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true }));
    expect(await apiRequest("/x")).toEqual({ ok: false, network: true });
  });

  it("defaults a missing message to empty", async () => {
    fetchMock.mockResolvedValue(respond({ ok: false, code: "FORBIDDEN" }));
    expect(await apiRequest("/x")).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "",
    });
  });
});

describe("apiRequest broken store", () => {
  beforeEach(() => {
    rn.OS = "ios";
    store.readSessionToken.mockRejectedValue(new Error("keystore"));
  });

  it("sign-in skips the token read and stores the new token", async () => {
    fetchMock.mockResolvedValue(
      respond(
        { ok: true, data: null },
        { headers: { "set-auth-token": "t9" } },
      ),
    );
    const result = await apiRequest("/api/v1/session", {
      method: "POST",
      body: {},
    });
    expect(result).toEqual({ ok: true, data: null });
    expect(store.readSessionToken).not.toHaveBeenCalled();
    expect(sentHeaders().get("authorization")).toBeNull();
    expect(store.writeSessionToken).toHaveBeenCalledWith("t9");
  });

  it("other paths give network without fetch", async () => {
    expect(await apiRequest("/api/v1/me")).toEqual({
      ok: false,
      network: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a failing token write is network", async () => {
    store.writeSessionToken.mockRejectedValue(new Error("full"));
    fetchMock.mockResolvedValue(
      respond(
        { ok: true, data: null },
        { headers: { "set-auth-token": "t9" } },
      ),
    );
    expect(
      await apiRequest("/api/v1/register", { method: "POST", body: {} }),
    ).toEqual({
      ok: false,
      network: true,
    });
  });
});

describe("apiRequest transport", () => {
  it("web uses cookies and no bearer", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: null }));
    await apiRequest("/x");
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.credentials).toBe("include");
    expect(sentHeaders().get("accept-language")).toBe("ru-RU");
    expect(sentHeaders().get("authorization")).toBeNull();
    expect(sentHeaders().get("expo-origin")).toBeNull();
    expect(store.readSessionToken).not.toHaveBeenCalled();
  });

  it("native sends bearer and expo-origin and stores a rotated token", async () => {
    rn.OS = "ios";
    store.readSessionToken.mockResolvedValue("t1");
    fetchMock.mockResolvedValue(
      respond(
        { ok: true, data: null },
        { headers: { "set-auth-token": "t2" } },
      ),
    );
    await apiRequest("/x");
    expect(sentHeaders().get("authorization")).toBe("Bearer t1");
    expect(sentHeaders().get("expo-origin")).toBe("giftlist://");
    expect(store.writeSessionToken).toHaveBeenCalledWith("t2");
  });

  it("native: a failing token read is network and fetch is not called", async () => {
    rn.OS = "ios";
    store.readSessionToken.mockRejectedValue(new Error("keychain"));
    expect(await apiRequest("/x")).toEqual({ ok: false, network: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST sends method, content-type and JSON body", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: null }));
    await apiRequest("/x", { method: "POST", body: { a: 1 } });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
    expect(sentHeaders().get("content-type")).toBe("application/json");
  });
});
