import { beforeEach, describe, expect, it, vi } from "vitest";
import { keepReservation } from "@/api/my-gifts";

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

function card(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    title: "Наушники",
    description: null,
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "RESERVED",
    reservedBy: { id: "u2", nick: "anna", displayName: "Анна" },
    reservationLabel: null,
    ownerAction: null,
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
 * Story 5.6: the owner's answer «Не получал, оставить бронь». The keep endpoint
 * takes the contract's strict empty object, so the client must send `{}` with the
 * JSON content type; the answer is the owner card, and a lost race stays
 * `CONFLICT` for the screen to reread the list.
 */
describe("keepReservation", () => {
  it("POSTs the empty object with a JSON content type and accepts the owner card", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: card() }));

    const result = await keepReservation("g/1");

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.gift.id).toBe("g1");
      expect(result.gift.status).toBe("RESERVED");
      expect(result.gift.ownerAction).toBeNull();
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/gifts/g%2F1/reservation/keep");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect((init.headers as Headers).get("content-type")).toBe("application/json");
  });

  it("re-checks the card: a body outside the contract is invalid, not a keep", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "g1" } }));
    await expect(keepReservation("g1")).resolves.toEqual({ ok: false, invalid: true });

    // The owner never gets the due date, phase or `bought`: an extra key on the
    // card is outside the closed contract, so the client does not claim a keep.
    fetchMock.mockResolvedValue(
      respond({ ok: true, data: card({ phase: "ACTIVE" }) }),
    );
    await expect(keepReservation("g1")).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes CONFLICT through with its code, so the screen rereads the list", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "CONFLICT", message: "Reservation changed" }, 409),
    );
    await expect(keepReservation("g1")).resolves.toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Reservation changed",
    });
  });

  it("passes NOT_FOUND and VALIDATION through unchanged", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "NOT_FOUND", message: "Gift not found" }, 404),
    );
    await expect(keepReservation("g1")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });

    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "VALIDATION", message: "Invalid body", field: "body" }, 400),
    );
    await expect(keepReservation("g1")).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid body",
      field: "body",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(keepReservation("g1")).resolves.toEqual({ ok: false, network: true });
  });
});
