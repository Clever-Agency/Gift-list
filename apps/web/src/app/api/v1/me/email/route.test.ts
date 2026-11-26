import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requestEmailChange = vi.hoisted(() => vi.fn());
const cancelEmailChange = vi.hoisted(() => vi.fn());

vi.mock("@/actions/email-change", () => ({ cancelEmailChange, requestEmailChange }));

import { DELETE, GET, POST, PUT } from "./route";

function post(body: string) {
  return new Request("http://x/api/v1/me/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  requestEmailChange.mockReset();
  requestEmailChange.mockResolvedValue({ ok: true, data: { accepted: true } });
  cancelEmailChange.mockReset();
  cancelEmailChange.mockResolvedValue({ ok: true, data: { cancelled: true } });
});

describe("POST /api/v1/me/email", () => {
  it("passes the normalized address to the use-case and answers the AD-12 envelope", async () => {
    const res = await POST(post(JSON.stringify({ email: "  New@Example.com " })));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: { accepted: true } });
    expect(requestEmailChange).toHaveBeenCalledWith(
      { email: "new@example.com" },
      expect.any(Headers),
    );
  });

  it("answers 400 VALIDATION with field email for a malformed address", async () => {
    const res = await POST(post(JSON.stringify({ email: "anna" })));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "email",
    });
    expect(requestEmailChange).not.toHaveBeenCalled();
  });

  it("answers 400 for broken JSON without calling the use-case", async () => {
    const res = await POST(post("{not json"));

    expect(res.status).toBe(400);
    expect(requestEmailChange).not.toHaveBeenCalled();
  });

  it("answers 413 with the size reason before the use-case", async () => {
    const res = await POST(post(JSON.stringify({ email: `${"a".repeat(40_000)}@example.com` })));

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Payload too large",
      reason: "PAYLOAD_TOO_LARGE",
    });
    expect(requestEmailChange).not.toHaveBeenCalled();
  });

  it("keeps a rate-limit answer from the use-case", async () => {
    requestEmailChange.mockResolvedValue({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many email change attempts",
      params: { unit: "minute", count: 15 },
    });

    const res = await POST(post(JSON.stringify({ email: "new@example.com" })));

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
});

describe("DELETE /api/v1/me/email", () => {
  it("cancels the pending request and answers the AD-12 envelope", async () => {
    const res = await DELETE(
      new Request("http://x/api/v1/me/email", {
        method: "DELETE",
        headers: { cookie: "better-auth.session_token=t" },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { cancelled: true } });
    expect(cancelEmailChange).toHaveBeenCalledWith(expect.any(Headers));
  });

  it("keeps the use-case answer, e.g. a dead session", async () => {
    cancelEmailChange.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });

    const res = await DELETE(new Request("http://x/api/v1/me/email", { method: "DELETE" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });
});

describe("other methods on /api/v1/me/email", () => {
  it("GET and PUT are NOT_FOUND envelopes", async () => {
    for (const handler of [GET, PUT]) {
      const res = await handler(new Request("http://x/api/v1/me/email"));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });
});
