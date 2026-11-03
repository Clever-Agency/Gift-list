import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GiftUpdate } from "@gift-list/contracts";
import { updateGift } from "@/api/my-gifts";

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

const input: GiftUpdate = {
  title: "Наушники Sony",
  priceAmount: null,
};

const card = {
  id: "g/1",
  title: "Наушники Sony",
  description: null,
  priceAmount: null,
  priceCurrency: null,
  linkUrl: null,
  visibility: "PUBLIC",
  quantity: "SINGLE",
  expiresOn: null,
  archivedAt: null,
  tags: [],
  status: "OPEN",
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
};

beforeEach(() => {
  rn.OS = "web";
  fetchMock.mockReset();
  store.readSessionToken.mockReset();
  store.writeSessionToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("updateGift", () => {
  it("PATCHes the input as JSON to /api/v1/me/gifts/{encoded id} and returns the card", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: card }));

    await expect(updateGift("g/1", input)).resolves.toEqual({
      ok: true,
      gift: card,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/gifts/g%2F1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify(input));
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("returns a VALIDATION error with its field", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "VALIDATION",
          message: "Заголовок обязателен",
          field: "title",
        },
        400,
      ),
    );

    await expect(updateGift("g1", { title: "" })).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Заголовок обязателен",
      field: "title",
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

    await expect(updateGift("g1", input)).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it("passes a 404 through as an action error", async () => {
    fetchMock.mockResolvedValue(
      respond(
        { ok: false, code: "NOT_FOUND", message: "Gift not found" },
        404,
      ),
    );

    await expect(updateGift("g1", input)).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Gift not found",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(updateGift("g1", input)).resolves.toEqual({
      ok: false,
      network: true,
    });
  });

  it("rejects a card with an unknown key instead of returning it", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: true, data: { ...card, bought: true } }),
    );

    await expect(updateGift("g1", input)).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });
});
