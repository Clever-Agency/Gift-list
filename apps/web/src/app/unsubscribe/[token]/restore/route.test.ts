import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { applyUnsubscribe } = vi.hoisted(() => ({ applyUnsubscribe: vi.fn() }));

vi.mock("@/actions/unsubscribe", () => ({ applyUnsubscribe }));

import { POST } from "./route";

function request(token: string): Request {
  return new Request(`http://x/unsubscribe/${token}/restore`, { method: "POST" });
}

beforeEach(() => {
  applyUnsubscribe.mockReset();
  applyUnsubscribe.mockResolvedValue({ ok: true, type: "friendDates", enabled: true });
});

describe("POST /unsubscribe/:token/restore", () => {
  it("turns the switch back on inside the POST and redirects with restored=1", async () => {
    const res = await POST(
      request("tok-1"),
      { params: Promise.resolve({ token: "tok-1" }) },
    );

    expect(applyUnsubscribe).toHaveBeenCalledWith("tok-1", true);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://x/unsubscribe/tok-1?restored=1");
  });

  it("answers a forged token with the same 303 and writes nothing", async () => {
    applyUnsubscribe.mockResolvedValue({ ok: false });

    const res = await POST(
      request("forged"),
      { params: Promise.resolve({ token: "forged" }) },
    );

    expect(applyUnsubscribe).toHaveBeenCalledWith("forged", true);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://x/unsubscribe/forged?restored=1");
  });

  it("keeps a malformed segment inside the path and encodes it", async () => {
    const res = await POST(
      request("a%2Fb"),
      { params: Promise.resolve({ token: "a/b" }) },
    );

    expect(res.headers.get("location")).toBe("http://x/unsubscribe/a%2Fb?restored=1");
  });
});
