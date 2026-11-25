import { beforeEach, describe, expect, it, vi } from "vitest";
import { releaseMyReservation } from "@/api/viewer-gift";

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

/**
 * Story 5.2: the holder's release is `DELETE /api/v1/gifts/:id/reserve`, and the
 * answer is only `{ id }` — not a card, because after the release the holder may
 * no longer see the wish (AD-7). The screen applies the known transition itself.
 */
describe("releaseMyReservation", () => {
  it("DELETEs the reservation of one wish and accepts the echoed id", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "g/1" } }));

    await expect(releaseMyReservation("g/1")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/gifts/g%2F1/reserve");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBeNull();
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("rejects an answer without the same id instead of claiming a release", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "other" } }));
    await expect(releaseMyReservation("g1")).resolves.toEqual({ ok: false, invalid: true });

    fetchMock.mockResolvedValue(respond({ ok: true, data: {} }));
    await expect(releaseMyReservation("g1")).resolves.toEqual({ ok: false, invalid: true });

    fetchMock.mockResolvedValue(respond({ ok: true, data: null }));
    await expect(releaseMyReservation("g1")).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes 404 and 409 through as action errors, one body for every miss", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "NOT_FOUND", message: "Gift not found" }, 404),
    );
    await expect(releaseMyReservation("g1")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });

    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "CONFLICT", message: "Reservation changed" }, 409),
    );
    await expect(releaseMyReservation("g1")).resolves.toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Reservation changed",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(releaseMyReservation("g1")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });
});
