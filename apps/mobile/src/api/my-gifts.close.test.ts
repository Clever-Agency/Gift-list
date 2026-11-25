import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeGift, undoGiftClose } from "@/api/my-gifts";

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

/** The owner's closed card as the server answers it (AD-12, Story 5.3). */
function closedCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    title: "Наушники",
    description: null,
    priceAmount: 25000,
    priceCurrency: "USD",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "CLOSED",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    undoUntil: "2026-11-19T10:10:00.000Z",
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
 * Story 5.3 (FR-32, ARCH-A5): closing answers the owner's card with `undoUntil`,
 * the moment the server's window ends. The client counts down from it and does
 * not know the ten minutes.
 */
describe("closeGift", () => {
  it("POSTs the close of one own wish without a body and reads the owner's card", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: closedCard({ id: "g/1" }) }));

    await expect(closeGift("g/1")).resolves.toEqual({
      ok: true,
      gift: closedCard({ id: "g/1" }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/gifts/g%2F1/close");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect((init.headers as Headers).get("content-type")).toBeNull();
  });

  it("accepts a closed card with a past undoUntil and no reservation", async () => {
    fetchMock.mockResolvedValue(
      respond({
        ok: true,
        data: closedCard({ undoUntil: "2026-11-19T09:00:00.000Z" }),
      }),
    );

    const result = await closeGift("g1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.gift.undoUntil).toBe("2026-11-19T09:00:00.000Z");
  });

  it("rejects a body that is not the owner's card instead of claiming a close", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "g1", status: "CLOSED" } }));
    await expect(closeGift("g1")).resolves.toEqual({ ok: false, invalid: true });

    fetchMock.mockResolvedValue(respond({ ok: true, data: closedCard({ undoUntil: 1_760_000_000 }) }));
    await expect(closeGift("g1")).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes 409 through, so the screen rereads the list", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "CONFLICT", message: "Already closed" }, 409),
    );
    await expect(closeGift("g1")).resolves.toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Already closed",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(closeGift("g1")).resolves.toEqual({ ok: false, network: true });
  });
});

describe("undoGiftClose", () => {
  it("POSTs the undo of one own wish without a body and reads the owner's card", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: true, data: closedCard({ id: "g/1", status: "OPEN", undoUntil: null }) }),
    );

    const result = await undoGiftClose("g/1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.gift.id).toBe("g/1");
      expect(result.gift.status).toBe("OPEN");
      expect(result.gift.undoUntil).toBeNull();
    }

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/gifts/g%2F1/undo-close");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  it("keeps UNDO_WINDOW_EXPIRED apart from a plain CONFLICT", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "CONFLICT",
          message: "Undo window expired",
          reason: "UNDO_WINDOW_EXPIRED",
        },
        409,
      ),
    );

    await expect(undoGiftClose("g1")).resolves.toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Undo window expired",
      reason: "UNDO_WINDOW_EXPIRED",
    });

    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "CONFLICT", message: "Status changed" }, 409),
    );
    const race = await undoGiftClose("g1");
    expect(race.ok).toBe(false);
    if (!race.ok) expect("reason" in race && race.reason).toBeFalsy();
  });

  it("passes 404 through for a foreign or missing wish", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "NOT_FOUND", message: "Gift not found" }, 404),
    );
    await expect(undoGiftClose("g1")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
  });

  it("rejects a body without the card shape instead of claiming the undo", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { ok: true } }));
    await expect(undoGiftClose("g1")).resolves.toEqual({ ok: false, invalid: true });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(undoGiftClose("g1")).resolves.toEqual({ ok: false, network: true });
  });
});
