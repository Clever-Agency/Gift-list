import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteGift } from "@/api/my-gifts";

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

beforeEach(() => {
  rn.OS = "web";
  fetchMock.mockReset();
  store.readSessionToken.mockReset();
  store.writeSessionToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("deleteGift", () => {
  it("DELETEs /api/v1/me/gifts/{encoded id} without a body and returns ok", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "g/1" } }));

    await expect(deleteGift("g/1")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/gifts/g%2F1");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBeNull();
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("passes a 409 CONFLICT through as an action error", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "CONFLICT",
          message: "Only an open wish can be deleted here",
        },
        409,
      ),
    );

    await expect(deleteGift("g1")).resolves.toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Only an open wish can be deleted here",
    });
  });

  it("passes a 404 NOT_FOUND through as an action error", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "NOT_FOUND", message: "Gift not found" }, 404),
    );

    await expect(deleteGift("g1")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
  });

  it("passes a 401 through as an action error", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "UNAUTHENTICATED",
          message: "Authentication required",
        },
        401,
      ),
    );

    await expect(deleteGift("g1")).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(deleteGift("g1")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });

  it("rejects a body that does not echo the deleted id", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "other" } }));

    await expect(deleteGift("g1")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });

  it("rejects a body without an id at all", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: null }));

    await expect(deleteGift("g1")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });
});
