import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { processDateReminders } = vi.hoisted(() => ({
  processDateReminders: vi.fn(),
}));

vi.mock("@/lib/date-reminders-store", () => ({
  processDateReminders,
}));

import { GET, POST } from "./route";

const secret = "01234567890123456789012345678901";

beforeEach(() => {
  processDateReminders.mockReset();
  process.env.CRON_SECRET = secret;
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = secret;
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
});

function post(authorization?: string) {
  return new Request("http://localhost/api/cron/date-reminders", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

function schemaError(code: "P2021" | "P2022") {
  return Object.assign(new Error(`missing schema object ${code}`), { code });
}

describe("POST /api/cron/date-reminders", () => {
  it("rejects a missing or wrong secret without calling the service", async () => {
    expect((await POST(post())).status).toBe(401);
    expect((await POST(post("Bearer wrong-secret-value-but-long-enough"))).status).toBe(401);
    expect(processDateReminders).not.toHaveBeenCalled();
  });

  it("returns the sent counter only", async () => {
    processDateReminders.mockResolvedValue({ sent: 3, failed: 0 });
    const response = await POST(post(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, data: { sent: 3 } });
  });

  it.each(["P2021", "P2022"] as const)(
    "skips a run whose schema is not migrated yet (%s)",
    async function schemaSkip(code) {
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      processDateReminders.mockRejectedValue(schemaError(code));

      const response = await POST(post(`Bearer ${secret}`));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true, data: { skipped: "schema" } });
      expect(spy).toHaveBeenCalledExactlyOnceWith("date-reminders: schema not migrated, skipped");
      spy.mockRestore();
    },
  );

  it("answers 500 without a body or details when the run fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    processDateReminders.mockRejectedValue(new Error("secret title"));
    const response = await POST(post(`Bearer ${secret}`));
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret title");
    spy.mockRestore();
  });

  it("answers 500 without a body when some pairs failed", async () => {
    processDateReminders.mockResolvedValue({ sent: 1, failed: 1 });
    const response = await POST(post(`Bearer ${secret}`));
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("");
  });

  it("answers GET as not found", async () => {
    const response = GET();
    expect(response.status).toBe(404);
  });
});
