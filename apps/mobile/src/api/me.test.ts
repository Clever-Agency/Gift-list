import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateNick } from "@/api/me";

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

const fetchMock = vi.fn();

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const me = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anna",
  timeZone: "Europe/Minsk",
};

beforeEach(() => {
  rn.OS = "web";
  fetchMock.mockReset();
  store.readSessionToken.mockReset();
  store.writeSessionToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("updateNick", () => {
  it("PUTs the nick as JSON to /api/v1/me/nick and returns the user", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: me }));

    await expect(updateNick("new_nick")).resolves.toEqual({ ok: true, data: me });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/nick");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ nick: "new_nick" }));
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("returns the NICK_TAKEN reason on the nick field", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "VALIDATION",
          message: "Nick is taken",
          field: "nick",
          reason: "NICK_TAKEN",
        },
        400,
      ),
    );

    await expect(updateNick("anna")).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Nick is taken",
      field: "nick",
      reason: "NICK_TAKEN",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(updateNick("new_nick")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });

  it("rejects a user with an unknown key instead of returning it", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: true, data: { ...me, hideFromSearch: true } }),
    );

    await expect(updateNick("new_nick")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });
});
