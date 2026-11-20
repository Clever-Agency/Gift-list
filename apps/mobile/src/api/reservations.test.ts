import type { ReservationCard } from "@gift-list/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchReservations, updateReservation } from "@/api/reservations";

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

function card(overrides: Partial<ReservationCard> = {}): ReservationCard {
  return {
    giftId: "g1",
    titleSnapshot: "Плед",
    status: "RESERVED",
    ownerNick: "anya",
    dueAt: "2026-12-01",
    phase: "ACTIVE",
    bought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    canOpenGift: true,
    ...overrides,
  };
}

beforeEach(() => {
  rn.OS = "web";
  fetchMock.mockReset();
  store.readSessionToken.mockReset();
  store.writeSessionToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

/**
 * Story 5.5 (FR-25, A-14, AD-7): «Мои брони» — закрытый набор полей карточки
 * держателя, без токена списка и чужих желаний. Тело перепроверяется общим
 * контрактом, поэтому лишнее поле — `invalid`, а не «сломанная сеть».
 */
describe("fetchReservations", () => {
  it("GETs the holder's list and keeps the server order", async () => {
    fetchMock.mockResolvedValue(
      respond({
        ok: true,
        data: {
          reservations: [
            card(),
            card({ giftId: "g2", titleSnapshot: "Свитер", dueAt: "2026-12-05" }),
          ],
        },
      }),
    );

    const result = await fetchReservations();
    expect(result).toEqual({
      ok: true,
      reservations: [
        card(),
        card({ giftId: "g2", titleSnapshot: "Свитер", dueAt: "2026-12-05" }),
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/reservations");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("accepts an empty list as a ready answer", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { reservations: [] } }));
    await expect(fetchReservations()).resolves.toEqual({ ok: true, reservations: [] });
  });

  it("rejects a card outside the closed set", async () => {
    fetchMock.mockResolvedValue(
      respond({
        ok: true,
        data: { reservations: [{ ...card(), listToken: "abc" }] },
      }),
    );
    await expect(fetchReservations()).resolves.toEqual({ ok: false, invalid: true });

    fetchMock.mockResolvedValue(
      respond({
        ok: true,
        data: {
          reservations: [
            { ...card(), dueAt: "2026-02-31" },
          ],
        },
      }),
    );
    await expect(fetchReservations()).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes an expired session through as an action error", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401),
    );
    await expect(fetchReservations()).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("reports a broken connection as a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(fetchReservations()).resolves.toEqual({ ok: false, network: true });
  });
});

/**
 * Story 5.5: одно действие за запрос. Тело — закрытый union, поэтому два
 * действия или лишний ключ не уходят на сервер вовсе.
 */
describe("updateReservation", () => {
  it("PATCHes an extension with the chosen day", async () => {
    fetchMock.mockResolvedValue(
      respond({
        ok: true,
        data: card({ dueAt: "2026-12-11", phase: "ACTIVE" }),
      }),
    );

    const result = await updateReservation("g/1", { action: "extend", dueOn: "2026-12-11" });
    expect(result).toEqual({
      ok: true,
      reservation: card({ dueAt: "2026-12-11", phase: "ACTIVE" }),
    });

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/reservations/g%2F1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ action: "extend", dueOn: "2026-12-11" }));
    expect((init.headers as Headers).get("content-type")).toBe("application/json");
  });

  it("sends «Купил» and both switches as their own bodies", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: card({ bought: true }) }));
    await updateReservation("g1", { action: "bought", value: true });
    expect(fetchMock.mock.calls[0]![1].body).toBe(
      JSON.stringify({ action: "bought", value: true }),
    );

    fetchMock.mockResolvedValue(
      respond({
        ok: true,
        data: card({ holderVisibleToOwner: true, holderVisibleToOthers: false }),
      }),
    );
    await updateReservation("g1", {
      action: "visibility",
      holderVisibleToOwner: true,
      holderVisibleToOthers: false,
    });
    expect(fetchMock.mock.calls[1]![1].body).toBe(
      JSON.stringify({
        action: "visibility",
        holderVisibleToOwner: true,
        holderVisibleToOthers: false,
      }),
    );
  });

  it("refuses a body with two actions, a stray key or an impossible day", async () => {
    await expect(
      updateReservation("g1", { action: "bought", value: true, dueOn: "2026-12-01" } as never),
    ).resolves.toEqual({ ok: false, invalid: true });
    await expect(
      updateReservation("g1", { action: "extend", dueOn: "2026-02-31" }),
    ).resolves.toEqual({ ok: false, invalid: true });
    await expect(
      updateReservation("g1", { action: "visibility", holderVisibleToOwner: true } as never),
    ).resolves.toEqual({ ok: false, invalid: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the out-of-range answer with `params.max` for the dialog", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "VALIDATION",
          message: "Due date out of range",
          reason: "DUE_OUT_OF_RANGE",
          params: { max: "20.12.2026" },
        },
        422,
      ),
    );

    await expect(
      updateReservation("g1", { action: "extend", dueOn: "2027-01-01" }),
    ).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Due date out of range",
      reason: "DUE_OUT_OF_RANGE",
      params: { max: "20.12.2026" },
    });
  });

  it("passes a lost race through, so the screen rereads the list", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "CONFLICT", message: "The reservation cannot be changed" }, 409),
    );
    await expect(
      updateReservation("g1", { action: "bought", value: false }),
    ).resolves.toEqual({
      ok: false,
      code: "CONFLICT",
      message: "The reservation cannot be changed",
    });

    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "NOT_FOUND", message: "Gift not found" }, 404),
    );
    await expect(
      updateReservation("g1", { action: "extend", dueOn: "2026-12-11" }),
    ).resolves.toEqual({ ok: false, code: "NOT_FOUND", message: "Gift not found" });
  });

  it("rejects an answer that is not a reservation card", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "g1" } }));
    await expect(
      updateReservation("g1", { action: "bought", value: true }),
    ).resolves.toEqual({ ok: false, invalid: true });
  });

  it("reports a broken connection on an action as a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(
      updateReservation("g1", { action: "bought", value: true }),
    ).resolves.toEqual({ ok: false, network: true });
  });
});
