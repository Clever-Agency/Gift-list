import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { applyUnsubscribe } = vi.hoisted(() => ({ applyUnsubscribe: vi.fn() }));

vi.mock("@/actions/unsubscribe", () => ({ applyUnsubscribe }));

import { POST } from "./route";

function request(): Request {
  return new Request("http://x/unsubscribe/tok-1/one-click", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });
}

beforeEach(() => {
  applyUnsubscribe.mockReset();
  applyUnsubscribe.mockResolvedValue({ ok: true, type: "friendDates", enabled: false });
});

describe("POST /unsubscribe/:token/one-click", () => {
  it("turns the reminder switch off and answers 200 without a page", async () => {
    const res = await POST(request(), { params: Promise.resolve({ token: "tok-1" }) });

    expect(applyUnsubscribe).toHaveBeenCalledWith("tok-1", false);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers a forged token with the same neutral 200 and no body", async () => {
    applyUnsubscribe.mockResolvedValue({ ok: false });

    const res = await POST(request(), { params: Promise.resolve({ token: "forged" }) });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });
});
