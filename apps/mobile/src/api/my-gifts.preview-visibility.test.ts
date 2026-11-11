import { beforeEach, describe, expect, it, vi } from "vitest";
import { previewGiftVisibility } from "@/api/my-gifts";

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
 * CLE-82/S23.2: the client half of the preflight. It is a read — no body, no
 * content-type — and the value travels in the query, so the PATCH stays the only
 * write of a visibility change (S23.3 shows the confirm from this answer).
 */
describe("previewGiftVisibility", () => {
  it("GETs the preflight of one wish with the value in the query and no body", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { wouldCancelReservation: true } }));

    await expect(previewGiftVisibility("g/1", "FRIENDS")).resolves.toEqual({
      ok: true,
      preview: { wouldCancelReservation: true },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/me/gifts/g%2F1/visibility?visibility=FRIENDS");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe("include");
    const headers = init.headers as Headers;
    // A read carries no body, so it must not claim JSON.
    expect(headers.get("content-type")).toBeNull();
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("accept-language")).toBe("ru-RU");
  });

  it("keeps a releasing answer and a keeping answer apart", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { wouldCancelReservation: false } }));

    await expect(previewGiftVisibility("g1", "SECRET")).resolves.toEqual({
      ok: true,
      preview: { wouldCancelReservation: false },
    });
  });

  it("passes the archived-wish VALIDATION through with its reason", async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          ok: false,
          code: "VALIDATION",
          message: "Archived wish is read-only",
          reason: "GIFT_ARCHIVED",
        },
        400,
      ),
    );

    await expect(previewGiftVisibility("g1", "FRIENDS")).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Archived wish is read-only",
      reason: "GIFT_ARCHIVED",
    });
  });

  it("passes a 404 through as an action error", async () => {
    fetchMock.mockResolvedValue(
      respond({ ok: false, code: "NOT_FOUND", message: "Wishlist not found" }, 404),
    );

    await expect(previewGiftVisibility("g1", "FRIENDS")).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Wishlist not found",
    });
  });

  it("reports a network failure like the other clients", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));

    await expect(previewGiftVisibility("g1", "FRIENDS")).resolves.toEqual({
      ok: false,
      network: true,
    });
  });

  it("rejects an answer that is not the shared contract", async () => {
    fetchMock.mockResolvedValue(respond({ ok: true, data: { wouldCancelReservation: "yes" } }));

    await expect(previewGiftVisibility("g1", "FRIENDS")).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });
});
