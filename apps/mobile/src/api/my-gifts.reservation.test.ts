import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchReservationWarning, releaseReservation } from "@/api/my-gifts";

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
 * Story 5.2 (FR-31, AD-12): the owner's preflight answers only the warning. The
 * contract is strict, so a body with the holder, the due date, the phase or
 * `bought` is not a warning the screen may show.
 */
describe("fetchReservationWarning", () => {
  it("GETs the preflight of one own wish, no body", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { warning: "BOUGHT" } }));

    await expect(fetchReservationWarning("g/1")).resolves.toEqual({
      ok: true,
      warning: "BOUGHT",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/gifts/g%2F1/reservation");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect((init.headers as Headers).get("content-type")).toBeNull();
  });

  it("keeps a plain reservation and the contract's future GIVEN apart", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { warning: null } }));
    await expect(fetchReservationWarning("g1")).resolves.toEqual({ ok: true, warning: null });

    // Story 5.7 will send this value; the client already renders its sentence.
    fetchMock.mockResolvedValue(respond({ ok: true, data: { warning: "GIVEN" } }));
    await expect(fetchReservationWarning("g1")).resolves.toEqual({ ok: true, warning: "GIVEN" });
  });

  it("rejects a body with reservation fields or an unknown warning", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: true, data: { warning: "BOUGHT", holder: "Анна" } }),
    );
    await expect(fetchReservationWarning("g1")).resolves.toEqual({ ok: false, invalid: true });

    fetchMock.mockResolvedValue(respond({ ok: true, data: { warning: "SOLD" } }));
    await expect(fetchReservationWarning("g1")).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes 404 through as an action error", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "NOT_FOUND", message: "Gift not found" }, 404),
    );
    await expect(fetchReservationWarning("g1")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(fetchReservationWarning("g1")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });
});

describe("releaseReservation", () => {
  it("DELETEs the reservation of one own wish and accepts the echoed id", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "g/1" } }));

    await expect(releaseReservation("g/1")).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/gifts/g%2F1/reservation");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("rejects an answer without the same id instead of claiming a release", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "other" } }));
    await expect(releaseReservation("g1")).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes 409 through with its code, so the screen rereads the list", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "CONFLICT", message: "Reservation changed" }, 409),
    );
    await expect(releaseReservation("g1")).resolves.toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Reservation changed",
    });
  });
});
