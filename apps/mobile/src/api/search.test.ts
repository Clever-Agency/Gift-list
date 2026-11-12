import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchUsers } from "@/api/search";
import { prepareUserSearchQuery } from "@/search/search-query";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

const alena = { displayName: "Алёна", nick: "alena" };

function answer(data: unknown) {
  return { ok: true, data };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("prepareUserSearchQuery", () => {
  it("keeps a plain name and trims the edges", () => {
    expect(prepareUserSearchQuery("  Алёна ")).toBe("Алёна");
  });

  it("drops one optional leading @ of the «Имя или @ник» field", () => {
    expect(prepareUserSearchQuery("@alena")).toBe("alena");
    expect(prepareUserSearchQuery("  @alena  ")).toBe("alena");
  });

  it("turns a lone @ into an empty query", () => {
    expect(prepareUserSearchQuery("@")).toBe("");
    expect(prepareUserSearchQuery("  @  ")).toBe("");
  });

  it("does not strip an @ inside a display name", () => {
    expect(prepareUserSearchQuery("anna@example")).toBe("anna@example");
  });
});

describe("searchUsers", () => {
  it("GETs /api/v1/search with the encoded query and returns the people", async () => {
    api.apiRequest.mockResolvedValue(answer({ users: [alena] }));

    await expect(searchUsers("Алёна")).resolves.toEqual({ ok: true, users: [alena] });
    expect(api.apiRequest).toHaveBeenCalledWith(
      `/api/v1/search?q=${encodeURIComponent("Алёна")}`,
    );
  });

  it("sends the nick without the optional leading @", async () => {
    api.apiRequest.mockResolvedValue(answer({ users: [alena] }));

    await searchUsers("@alena");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/search?q=alena");
  });

  it("keeps an ordinary name as typed", async () => {
    api.apiRequest.mockResolvedValue(answer({ users: [] }));

    await searchUsers("  Иван ");

    expect(api.apiRequest).toHaveBeenCalledWith(
      `/api/v1/search?q=${encodeURIComponent("Иван")}`,
    );
  });

  it("encodes characters that would break the query string", async () => {
    api.apiRequest.mockResolvedValue(answer({ users: [] }));

    await searchUsers("имя & ник?");

    expect(api.apiRequest).toHaveBeenCalledWith(
      `/api/v1/search?q=${encodeURIComponent("имя & ник?")}`,
    );
  });

  it("treats an empty answer as a successful empty list", async () => {
    api.apiRequest.mockResolvedValue(answer({ users: [] }));

    await expect(searchUsers("никого")).resolves.toEqual({ ok: true, users: [] });
  });

  it("passes a transport error through", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });

    await expect(searchUsers("alena")).resolves.toEqual({ ok: false, network: true });
  });

  it("passes the session-expired answer through", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });

    await expect(searchUsers("alena")).resolves.toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });
  });

  it("rejects a body outside the search contract", async () => {
    api.apiRequest.mockResolvedValue(
      answer({ users: [{ ...alena, hideFromSearch: true }] }),
    );

    await expect(searchUsers("alena")).resolves.toEqual({ ok: false, invalid: true });
  });

  it("rejects a gift field that search never returns", async () => {
    api.apiRequest.mockResolvedValue(answer({ users: [{ ...alena, gifts: [] }] }));

    await expect(searchUsers("alena")).resolves.toEqual({ ok: false, invalid: true });
  });
});
