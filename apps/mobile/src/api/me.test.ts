import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelEmailChange,
  deleteAccount,
  getMyProfile,
  requestEmailChange,
  updateHideFromSearch,
  updateMyProfile,
  updateName,
  updateNick,
} from "@/api/me";

const rn = vi.hoisted(() => ({ OS: "web" }));
const store = vi.hoisted(() => ({
  readSessionToken: vi.fn(),
  writeSessionToken: vi.fn(),
  clearSessionToken: vi.fn(),
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
  hideFromSearch: false,
};

const profile = {
  ...me,
  birthDay: 14,
  birthMonth: 11,
  gender: "FEMALE",
  country: "BY",
  about: "Люблю книги",
  profileVisibleToFriends: true,
};

beforeEach(() => {
  rn.OS = "web";
  fetchMock.mockReset();
  store.readSessionToken.mockReset();
  store.writeSessionToken.mockReset();
  store.clearSessionToken.mockReset();
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
      respond({ ok: true, data: { ...me, emailVerified: true } }),
    );

    await expect(updateNick("new_nick")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });
});

describe("updateName", () => {
  it("PATCHes the name as JSON to /api/v1/me/name and returns the user", async () => {
    const renamed = { ...me, name: "Анна Ковалёва" };
    fetchMock.mockResolvedValue(respond({ ok: true, data: renamed }));

    await expect(updateName("Анна Ковалёва")).resolves.toEqual({ ok: true, data: renamed });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/name");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ name: "Анна Ковалёва" }));
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(updateName("Анна")).resolves.toEqual({ ok: false, network: true });
  });

  it("passes a 401 through, so the screen can sign out", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401),
    );

    await expect(updateName("Анна")).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("rejects a user without the new name instead of guessing it", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { ...me, name: 42 } }));

    await expect(updateName("Анна")).resolves.toEqual({ ok: false, invalid: true });
  });
});

describe("updateHideFromSearch", () => {
  it("PATCHes the flag as JSON to /api/v1/me/hide-from-search and returns the user", async () => {
    const hidden = { ...me, hideFromSearch: true };
    fetchMock.mockResolvedValue(respond({ ok: true, data: hidden }));

    await expect(updateHideFromSearch(true)).resolves.toEqual({ ok: true, data: hidden });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/hide-from-search");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ hideFromSearch: true }));
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("sends false when the switch is turned off", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: me }));

    await updateHideFromSearch(false);

    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ hideFromSearch: false }));
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(updateHideFromSearch(true)).resolves.toEqual({
      ok: false,
      network: true,
    });
  });

  it("passes a 401 through, so the screen can sign out", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401),
    );

    await expect(updateHideFromSearch(true)).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("rejects a user without the flag instead of guessing its state", async () => {
    const { hideFromSearch, ...withoutFlag } = me;
    expect(hideFromSearch).toBe(false);
    fetchMock.mockResolvedValue(respond({ ok: true, data: withoutFlag }));

    await expect(updateHideFromSearch(true)).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });
});

describe("getMyProfile", () => {
  it("reads /api/v1/me/profile and returns the profile fields with the user", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: profile }));

    await expect(getMyProfile()).resolves.toEqual({ ok: true, data: profile });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/profile");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("rejects an answer without the profile fields instead of guessing them", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: me }));

    await expect(getMyProfile()).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes a 401 through, so the screen can sign out", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401),
    );

    await expect(getMyProfile()).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(getMyProfile()).resolves.toEqual({ ok: false, network: true });
  });
});

describe("updateMyProfile", () => {
  it("PATCHes the whole block as JSON to /api/v1/me/profile", async () => {
    const body = {
      birthDay: 29,
      birthMonth: 2,
      gender: "MALE" as const,
      country: "BY",
      about: "Люблю книги",
      profileVisibleToFriends: false,
    };
    const saved = { ...profile, ...body };
    fetchMock.mockResolvedValue(respond({ ok: true, data: saved }));

    await expect(updateMyProfile(body)).resolves.toEqual({ ok: true, data: saved });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/profile");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify(body));
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("sends a cleared birthday as the null pair", async () => {
    const body = {
      birthDay: null,
      birthMonth: null,
    };
    fetchMock.mockResolvedValue(respond({ ok: true, data: { ...profile, ...body } }));

    await updateMyProfile(body);

    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ birthDay: null, birthMonth: null }));
  });

  it("passes a field rejection through, so the form can name the field", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "VALIDATION",
          message: "Birth day does not exist in that month",
          field: "birthDay",
        },
        400,
      ),
    );

    await expect(updateMyProfile({ birthDay: 30, birthMonth: 2 })).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Birth day does not exist in that month",
      field: "birthDay",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(updateMyProfile({ about: "Привет" })).resolves.toEqual({
      ok: false,
      network: true,
    });
  });
});

describe("requestEmailChange", () => {
  it("POSTs the address to /api/v1/me/email and keeps the neutral answer", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { accepted: true } }));

    await expect(requestEmailChange("new@example.com")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/email");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "new@example.com" }));
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("passes the rate limit through with its wait", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: "Too many email change attempts",
          params: { unit: "minute", count: 15 },
        },
        429,
      ),
    );

    await expect(requestEmailChange("new@example.com")).resolves.toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many email change attempts",
      params: { unit: "minute", count: 15 },
    });
  });

  it("rejects an answer without the accepted flag instead of announcing a letter", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: {} }));

    await expect(requestEmailChange("new@example.com")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(requestEmailChange("new@example.com")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });
});

describe("deleteAccount", () => {
  it("DELETEs /api/v1/me with an explicit confirmation and clears the local session", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { deleted: true } }));

    await expect(deleteAccount()).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBe(JSON.stringify({ confirm: true }));
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the command answers busy", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "CONFLICT",
          message: "Account deletion is in progress, retry",
        },
        409,
      ),
    );

    await expect(deleteAccount()).resolves.toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Account deletion is in progress, retry",
    });
    expect(store.clearSessionToken).not.toHaveBeenCalled();
  });

  it("keeps the session on a dead or foreign session, so the screen can sign out itself", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401),
    );

    await expect(deleteAccount()).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(store.clearSessionToken).not.toHaveBeenCalled();
  });

  it("rejects a success without the deleted flag instead of clearing the session", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: {} }));

    await expect(deleteAccount()).resolves.toEqual({ ok: false, invalid: true });
    expect(store.clearSessionToken).not.toHaveBeenCalled();
  });

  it("reports a network failure and keeps the session", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(deleteAccount()).resolves.toEqual({ ok: false, network: true });
    expect(store.clearSessionToken).not.toHaveBeenCalled();
  });
});

describe("cancelEmailChange", () => {
  it("DELETEs the pending request and returns the cancelled answer", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { cancelled: true } }));

    await expect(cancelEmailChange()).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/email");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("include");
  });

  it("passes a dead session through, so the screen can sign out", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401),
    );

    await expect(cancelEmailChange()).resolves.toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });

  it("rejects an answer without the cancelled flag", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { accepted: true } }));

    await expect(cancelEmailChange()).resolves.toEqual({ ok: false, invalid: true });
  });
});

