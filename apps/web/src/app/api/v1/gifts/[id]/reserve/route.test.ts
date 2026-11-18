import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { reserveGift } = vi.hoisted(() => ({ reserveGift: vi.fn() }));

vi.mock("@/actions/gift-reserve", () => ({ reserveGift }));

beforeEach(() => {
  reserveGift.mockReset();
  reserveGift.mockResolvedValue({ ok: true, data: { id: "g1" } });
});

describe("POST /api/v1/gifts/[id]/reserve", () => {
  it("passes the list token and the parsed body into the action", async () => {
    const { POST } = await import("./route");
    const body = {
      dueOn: "2026-12-01",
      holderVisibleToOwner: true,
      holderVisibleToOthers: false,
    };
    const response = await POST(
      new Request("http://x/api/v1/gifts/g1/reserve?listToken=list_token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "g1" }) },
    );

    expect(response.status).toBe(200);
    expect(reserveGift).toHaveBeenCalledWith(expect.any(Headers), "g1", body, "list_token");
  });
});
