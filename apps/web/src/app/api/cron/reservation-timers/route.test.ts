import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { processReservationTimers } = vi.hoisted(() => ({
  processReservationTimers: vi.fn(),
}));

vi.mock("@/lib/gift-status-store", () => ({
  processReservationTimers,
}));

import { GET, POST } from "./route";

const secret = "01234567890123456789012345678901";

beforeEach(() => {
  processReservationTimers.mockReset();
  process.env.CRON_SECRET = secret;
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = secret;
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
});

function post(authorization?: string) {
  return new Request("http://localhost/api/cron/reservation-timers", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("POST /api/cron/reservation-timers", () => {
  it("rejects a missing or wrong secret without calling the service", async () => {
    expect((await POST(post())).status).toBe(401);
    expect((await POST(post("Bearer wrong-secret-value-but-long-enough"))).status).toBe(401);
    expect(processReservationTimers).not.toHaveBeenCalled();
  });

  it("returns only the three counters", async () => {
    processReservationTimers.mockResolvedValue({
      expiredToGiver: 2,
      askedOwner: 1,
      released: 1,
      failed: 0,
    });

    const response = await POST(post(`Bearer ${secret}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: { expiredToGiver: 2, askedOwner: 1, released: 1 },
    });
  });

  /** A partly failed run must not name a row, an id or a moment. */
  it("answers 500 without a body when some rows failed", async () => {
    processReservationTimers.mockResolvedValue({
      expiredToGiver: 1,
      askedOwner: 0,
      released: 0,
      failed: 1,
    });

    const response = await POST(post(`Bearer ${secret}`));

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("");
  });

  it("answers 500 without a body when the run throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    processReservationTimers.mockRejectedValue(new Error("secret title"));

    const response = await POST(post(`Bearer ${secret}`));

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret title");
    spy.mockRestore();
  });

  it("answers GET as not found", async () => {
    const response = GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
  });
});
