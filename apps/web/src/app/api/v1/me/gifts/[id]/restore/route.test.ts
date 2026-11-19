import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { restoreGift } = vi.hoisted(() => ({ restoreGift: vi.fn() }));

vi.mock("@/actions/restore-gift", () => ({ restoreGift }));

import { GET, POST } from "./route";

beforeEach(() => {
  restoreGift.mockReset();
  restoreGift.mockResolvedValue({
    ok: true,
    data: { id: "g1", title: "Книга" },
  });
});

function post(body: unknown, id = "g1") {
  return POST(
    new Request("http://x/api/v1/me/gifts/g1/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("POST /api/v1/me/gifts/[id]/restore", () => {
  it("hands the id and body to restoreGift", async () => {
    const res = await post({ expiresOn: "2026-12-31" });

    expect(res.status).toBe(200);
    expect(restoreGift).toHaveBeenCalledTimes(1);
    const [headers, id, body] = restoreGift.mock.calls[0] as [Headers, string, unknown];
    expect(id).toBe("g1");
    expect(body).toEqual({ expiresOn: "2026-12-31" });
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("returns VALIDATION for a past day", async () => {
    restoreGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "expiresOn",
    });

    const res = await post({ expiresOn: "2026-11-09" });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "expiresOn",
    });
  });

  it("answers GET as not found and does not call the action", async () => {
    const res = GET();
    expect(res.status).toBe(404);
    expect(restoreGift).not.toHaveBeenCalled();
  });
});
