import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTagCatalog } from "@/api/tags";

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

const tags = [
  { id: "tag_dream", slug: "dream", label: "мечта" },
  { id: "tag_need", slug: "need-now", label: "нужно сейчас" },
];

beforeEach(() => {
  rn.OS = "web";
  fetchMock.mockReset();
  store.readSessionToken.mockReset();
  store.writeSessionToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("fetchTagCatalog", () => {
  it("GETs /api/v1/tags with the request language and returns server labels", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { tags } }));

    await expect(fetchTagCatalog()).resolves.toEqual({ ok: true, tags });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/tags");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("an empty catalogue is a ready answer with no tags", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { tags: [] } }));

    await expect(fetchTagCatalog()).resolves.toEqual({ ok: true, tags: [] });
  });

  it("rejects a body that breaks the shared contract", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: true, data: { tags: [{ ...tags[0], aggregateEligible: true }] } }),
    );

    await expect(fetchTagCatalog()).resolves.toEqual({ ok: false, invalid: true });
  });

  it("passes the envelope error through, including the catalogue outage", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "NOT_FOUND", message: "Tag catalog is unavailable" }, 404),
    );

    await expect(fetchTagCatalog()).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Tag catalog is unavailable",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(fetchTagCatalog()).resolves.toEqual({ ok: false, network: true });
  });
});
