import { beforeEach, describe, expect, it, vi } from "vitest";

const { handleGet, handlePost } = vi.hoisted(() => ({
  handleGet: vi.fn(),
  handlePost: vi.fn(),
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({
    GET: handleGet,
    POST: handlePost,
    PATCH: handlePost,
    PUT: handlePost,
    DELETE: handlePost,
  }),
}));
vi.mock("@/lib/auth", () => ({ auth: {} }));

import { GET, POST } from "./route";

const encoder = new TextEncoder();
const TOO_LARGE = {
  ok: false,
  code: "VALIDATION",
  message: "Payload too large",
  reason: "PAYLOAD_TOO_LARGE",
};

function authRequest(path: string, body: string, headers: Record<string, string> = {}) {
  return new Request(`http://x/api/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

beforeEach(() => {
  handleGet.mockReset();
  handlePost.mockReset();
  handleGet.mockResolvedValue(jsonResponse({ ok: true }));
  handlePost.mockResolvedValue(jsonResponse({ ok: true }));
});

describe("POST /api/auth/[...all] body guard", () => {
  it("passes an ordinary body to better-auth byte-for-byte", async () => {
    const body = JSON.stringify({ email: "a@example.com", password: "password1", note: "😀" });

    const res = await POST(authRequest("sign-in/email", body, { "expo-origin": "giftlist://" }));

    expect(res.status).toBe(200);
    expect(handlePost).toHaveBeenCalledTimes(1);
    const forwarded = handlePost.mock.calls[0]?.[0] as Request;
    expect(forwarded.method).toBe("POST");
    expect(forwarded.url).toBe("http://x/api/auth/sign-in/email");
    expect(forwarded.headers.get("content-type")).toBe("application/json");
    // Headers that better-auth reads for the session/token flow survive the copy.
    expect(forwarded.headers.get("expo-origin")).toBe("giftlist://");
    expect(forwarded.headers.get("content-length")).toBe(String(encoder.encode(body).length));
    expect(await forwarded.text()).toBe(body);
  });

  it("answers 413 and never calls the handler for an oversized body", async () => {
    const body = JSON.stringify({ email: "a@example.com", pad: "a".repeat(40_000) });

    const res = await POST(authRequest("sign-up/email", body));

    expect(res.status).toBe(413);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual(TOO_LARGE);
    expect(handlePost).not.toHaveBeenCalled();
  });

  it("refuses an oversized chunked body without Content-Length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(4096));
      },
    });
    const request = new Request("http://x/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const res = await POST(request);

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual(TOO_LARGE);
    expect(handlePost).not.toHaveBeenCalled();
  });

  it("does not trust a Content-Length lower than the body", async () => {
    const body = JSON.stringify({ pad: "a".repeat(40_000) });

    const res = await POST(authRequest("sign-in/email", body, { "content-length": "10" }));

    expect(res.status).toBe(413);
    expect(handlePost).not.toHaveBeenCalled();
  });

  it("keeps the AD-12 not-found answer for a closed path", async () => {
    handlePost.mockResolvedValue(new Response("Not Found", { status: 404 }));

    const res = await POST(authRequest("closed/path", "{}"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });
});

describe("GET /api/auth/[...all]", () => {
  it("passes the request through untouched", async () => {
    const request = new Request("http://x/api/auth/get-session", {
      headers: { cookie: "session=1" },
    });

    const res = await GET(request);

    expect(res.status).toBe(200);
    expect(handleGet).toHaveBeenCalledTimes(1);
    expect(handleGet.mock.calls[0]?.[0]).toBe(request);
  });
});
