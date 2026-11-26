import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { headers, applyUnsubscribe, verifyUnsubscribeToken } = vi.hoisted(() => ({
  headers: vi.fn(),
  applyUnsubscribe: vi.fn(),
  verifyUnsubscribeToken: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers }));
vi.mock("@/actions/unsubscribe", () => ({ applyUnsubscribe }));
vi.mock("@/lib/unsubscribe-token", () => ({ verifyUnsubscribeToken }));

import { buildUnsubscribeMetadata, loadUnsubscribePage } from "./unsubscribe-page";

beforeEach(() => {
  headers.mockReset();
  applyUnsubscribe.mockReset();
  verifyUnsubscribeToken.mockReset();
  headers.mockResolvedValue(new Headers({ "accept-language": "ru-RU,ru;q=0.9" }));
});

describe("loadUnsubscribePage", () => {
  it("turns the switch off when the letter link is opened", async () => {
    applyUnsubscribe.mockResolvedValue({ ok: true, type: "friendDates", enabled: false });

    await expect(loadUnsubscribePage("token", false)).resolves.toEqual({
      locale: "ru",
      view: { kind: "done", type: "friendDates" },
    });
    expect(applyUnsubscribe).toHaveBeenCalledWith("token", false);
    expect(verifyUnsubscribeToken).not.toHaveBeenCalled();
  });

  it("only confirms a genuine token on the restored GET and writes nothing", async () => {
    verifyUnsubscribeToken.mockReturnValue({ userId: "user-1", type: "ownList" });

    await expect(loadUnsubscribePage("token", true)).resolves.toEqual({
      locale: "ru",
      view: { kind: "restored" },
    });
    expect(verifyUnsubscribeToken).toHaveBeenCalledWith("token");
    expect(applyUnsubscribe).not.toHaveBeenCalled();
  });

  it("answers a forged restored token neutrally and still writes nothing", async () => {
    verifyUnsubscribeToken.mockReturnValue(null);

    await expect(loadUnsubscribePage("forged", true)).resolves.toEqual({
      locale: "ru",
      view: { kind: "invalid" },
    });
    expect(applyUnsubscribe).not.toHaveBeenCalled();
  });

  it("answers a bad token and a deleted account with the one neutral view", async () => {
    applyUnsubscribe.mockResolvedValue({ ok: false });

    await expect(loadUnsubscribePage("forged", false)).resolves.toEqual({
      locale: "ru",
      view: { kind: "invalid" },
    });
  });
});

describe("buildUnsubscribeMetadata", () => {
  it("names only the purpose and the product and keeps the document out of search", () => {
    const metadata = buildUnsubscribeMetadata("ru", "WishMoon");

    expect(metadata.title).toBe("Отписка — WishMoon");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(metadata)).not.toContain("friendDates");
    expect(JSON.stringify(metadata)).not.toContain("ownList");
  });
});
