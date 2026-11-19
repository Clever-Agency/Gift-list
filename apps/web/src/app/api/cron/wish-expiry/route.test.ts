import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { processWishExpiry } = vi.hoisted(() => ({
  processWishExpiry: vi.fn(),
}));

vi.mock("@/lib/gift-status-store", () => ({
  processWishExpiry,
}));

import { GET, POST } from "./route";

const secret = "01234567890123456789012345678901";

beforeEach(() => {
  processWishExpiry.mockReset();
  process.env.CRON_SECRET = secret;
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = secret;
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
});

function post(authorization?: string) {
  return new Request("http://localhost/api/cron/wish-expiry", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("POST /api/cron/wish-expiry", () => {
  it("rejects a missing or wrong secret without calling the service", async () => {
    expect((await POST(post())).status).toBe(401);
    expect((await POST(post("Bearer wrong-secret-value-but-long-enough"))).status).toBe(401);
    expect(processWishExpiry).not.toHaveBeenCalled();
  });

  it("returns only the archived count", async () => {
    processWishExpiry.mockResolvedValue({ archived: 2, failed: 0 });
    const response = await POST(post(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { archived: 2 },
    });
  });

  it("answers 500 without a body or details when the run fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    processWishExpiry.mockRejectedValue(new Error("secret title"));
    const response = await POST(post(`Bearer ${secret}`));
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("");
    spy.mockRestore();
  });

  it("answers 500 without a body when some rows failed", async () => {
    processWishExpiry.mockResolvedValue({ archived: 1, failed: 1 });
    const response = await POST(post(`Bearer ${secret}`));
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("");
  });

  it("logs the failed run without the error message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    processWishExpiry.mockRejectedValue(new Error("secret title"));
    await POST(post(`Bearer ${secret}`));
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret title");
    spy.mockRestore();
  });

  it("answers GET as not found", async () => {
    const response = GET();
    expect(response.status).toBe(404);
  });
});
