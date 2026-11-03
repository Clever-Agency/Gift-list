import { describe, expect, it, vi } from "vitest";
import { actionErrorSchema } from "@gift-list/contracts";

vi.mock("server-only", () => ({}));

const envelope = { ok: false, code: "NOT_FOUND", message: "Not found" };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

async function expectEnvelope(
  handler: (request: Request) => Response | Promise<Response>,
  url: string,
  method: Method,
) {
  const response = await handler(new Request(url, { method }));
  expect(response.status, `${method} ${url}`).toBe(404);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const body: unknown = await response.json();
  expect(body).toEqual(envelope);
  expect(actionErrorSchema.safeParse(body).success).toBe(true);
}

describe("unknown /api paths", () => {
  it.each(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const)(
    "%s /api/nope is a NOT_FOUND envelope",
    async (method) => {
      const handlers = await import("./[...slug]/route");
      await expectEnvelope(handlers[method], "http://127.0.0.1:3000/api/nope", method);
    },
  );

  it("GET /api and GET /api/v1 are envelopes, not the Next HTML page", async () => {
    const api = await import("./route");
    const v1 = await import("./v1/route");
    await expectEnvelope(api.GET, "http://127.0.0.1:3000/api", "GET");
    await expectEnvelope(v1.GET, "http://127.0.0.1:3000/api/v1", "GET");
  });

  it.each([
    "http://127.0.0.1:3000/api/v1/nope",
    "http://127.0.0.1:3000/api/v1/nope/extra",
    "http://127.0.0.1:3000/api/v1/me/nope",
  ])("GET %s is a NOT_FOUND envelope", async (url) => {
    const handlers = await import("./v1/[...slug]/route");
    await expectEnvelope(handlers.GET, url, "GET");
    await expectEnvelope(handlers.POST, url, "POST");
  });
});

describe("unsupported methods on /api/v1", () => {
  it("unsupported methods on known /api/v1 paths are NOT_FOUND envelopes", async () => {
    const me = await import("./v1/me/route");
    const session = await import("./v1/session/route");
    const zone = await import("./v1/me/time-zone/route");
    const gifts = await import("./v1/me/gifts/route");
    await expectEnvelope(me.POST, "http://127.0.0.1:3000/api/v1/me", "POST");
    await expectEnvelope(session.GET, "http://127.0.0.1:3000/api/v1/session", "GET");
    await expectEnvelope(zone.GET, "http://127.0.0.1:3000/api/v1/me/time-zone", "GET");
    await expectEnvelope(gifts.POST, "http://127.0.0.1:3000/api/v1/me/gifts", "POST");
  });
});
