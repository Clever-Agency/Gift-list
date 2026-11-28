import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCollectionItem,
  fetchCollection,
  fetchCollections,
} from "@/api/collections";

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

const summary = {
  id: "c1",
  title: "Для рыбалки",
  description: null,
  coverImageUrl: "https://cdn.example.com/fishing.jpg",
  itemCount: 3,
};

const item = {
  id: "i1",
  title: "Термос",
  description: "Держит тепло сутки",
  linkUrl: "https://shop.example/termos",
  imageUrl: null,
};

const detail = { ...summary, itemCount: 1, items: [item] };

const card = {
  id: "g1",
  title: "Термос",
  description: "Держит тепло сутки",
  priceAmount: null,
  priceCurrency: null,
  linkUrl: "https://shop.example/termos",
  visibility: "PUBLIC",
  quantity: "SINGLE",
  expiresOn: null,
  archivedAt: null,
  tags: [],
  status: "OPEN",
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
  undoUntil: null,
};

beforeEach(() => {
  rn.OS = "web";
  fetchMock.mockReset();
  store.readSessionToken.mockReset();
  store.writeSessionToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("fetchCollections", () => {
  it("GETs /api/v1/collections and returns the published cards", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { collections: [summary] } }));

    await expect(fetchCollections()).resolves.toEqual({ ok: true, collections: [summary] });

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/collections");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("accept")).toBe("application/json");
  });

  it("keeps an empty list a ready answer", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { collections: [] } }));
    await expect(fetchCollections()).resolves.toEqual({ ok: true, collections: [] });
  });

  it("rejects a body that breaks the shared contract", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: true, data: { collections: [{ ...summary, publishedAt: null }] } }),
    );
    await expect(fetchCollections()).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes the envelope error through and reports a network failure", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }, 401),
    );
    await expect(fetchCollections()).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });

    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(fetchCollections()).resolves.toEqual({ ok: false, network: true });
  });
});

describe("fetchCollection", () => {
  it("GETs one published collection with its ideas", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: detail }));

    await expect(fetchCollection("c 1")).resolves.toEqual({ ok: true, collection: detail });

    const [url] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/collections/c%201");
  });

  it("turns NOT_FOUND into the closed not-found state", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "NOT_FOUND", message: "Not found" }, 404),
    );
    await expect(fetchCollection("c1")).resolves.toEqual({ ok: true, access: "not_found" });
  });

  it("rejects a body that breaks the shared contract", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: true, data: { ...detail, publishedAt: "2026-11-28T00:00:00.000Z" } }),
    );
    await expect(fetchCollection("c1")).resolves.toEqual({ ok: false, invalid: true });
  });
});

describe("addCollectionItem", () => {
  it("POSTs with no body and returns the created wish", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: card }, 201));

    await expect(addCollectionItem("c1", "i 1")).resolves.toEqual({ ok: true, gift: card });

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/collections/c1/items/i%201/add");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  it("passes the refusal through, including a wish limit", async () => {
    fetchMock.mockResolvedValue(
      respond(
        { ok: false, code: "VALIDATION", message: "Invalid input", field: "title" },
        400,
      ),
    );
    await expect(addCollectionItem("c1", "i1")).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
  });

  it("rejects an answer that is not a wish card and reports a network failure", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { id: "g1" } }));
    await expect(addCollectionItem("c1", "i1")).resolves.toEqual({ ok: false, invalid: true });

    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(addCollectionItem("c1", "i1")).resolves.toEqual({ ok: false, network: true });
  });
});
