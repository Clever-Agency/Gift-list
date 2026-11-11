import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ERROR_CODES } from "@gift-list/contracts";
import {
  guardRequestBody,
  infrastructureErrorResponse,
  MAX_JSON_BYTES,
  parseJson,
  parseJsonBody,
  toResponse,
} from "./api-v1";

const status = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 400,
  RATE_LIMITED: 429,
};

describe("toResponse", () => {
  it("maps ok to 200", async () => {
    const res = toResponse({ ok: true, data: { a: 1 } });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: { a: 1 } });
  });

  it.each(ERROR_CODES)("maps %s to its status", async (code) => {
    const body = { ok: false as const, code, message: "m" };
    const res = toResponse(body);
    expect(res.status).toBe(status[code]);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual(body);
  });
});

describe("infrastructureErrorResponse", () => {
  it("answers a bare 500 without the AD-12 envelope", async () => {
    const res = infrastructureErrorResponse();
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-type")).toBeNull();
    expect(await res.text()).toBe("");
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ email: z.string(), n: z.number() });
  function req(body: string) {
    return new Request("http://x/", {
      method: "POST",
      body,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  it("returns data when valid", async () => {
    expect(await parseJsonBody(req('{"email":"a","n":1}'), schema)).toEqual({
      ok: true,
      data: { email: "a", n: 1 },
    });
  });

  it("rejects a non-JSON content type without field", async () => {
    const r = await parseJsonBody(
      new Request("http://x/", {
        method: "POST",
        body: '{"email":"a","n":1}',
        headers: { "content-type": "text/plain" },
      }),
      schema,
    );
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(r).not.toHaveProperty("field");
  });

  it("rejects non-JSON without field", async () => {
    const r = await parseJsonBody(req("nope"), schema);
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(r).not.toHaveProperty("field");
  });

  it("rejects a body over the size limit", async () => {
    const r = await parseJsonBody(req(`{"email":"${"a".repeat(40_000)}","n":1}`), schema);
    expect(r).toMatchObject({ ok: false, code: "VALIDATION", reason: "PAYLOAD_TOO_LARGE" });
    expect(r).not.toHaveProperty("field");
    expect(toResponse(r).status).toBe(413);
  });

  it("rejects schema failure with the first path as field", async () => {
    expect(await parseJsonBody(req('{"email":"a","n":"x"}'), schema)).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "n",
    });
  });
});

const encoder = new TextEncoder();

const tooLargeEnvelope = {
  ok: false,
  code: "VALIDATION",
  message: "Payload too large",
  reason: "PAYLOAD_TOO_LARGE",
};

/** A valid JSON object of exactly `target` UTF-8 bytes, padded with `unit`. */
function jsonOfBytes(target: number, unit = "a"): string {
  const width = encoder.encode(unit).length;
  const count = (target - 8) / width;
  if (!Number.isInteger(count)) throw new Error(`unreachable byte count: ${target}`);
  return `{"a":"${unit.repeat(count)}"}`;
}

function requestWith(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://x/", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

function streamRequest(
  stream: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://x/", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

describe("body size limit", () => {
  it("accepts max-1 and max bytes, and answers 413 with the AD-12 envelope at max+1", async () => {
    expect((await parseJson(requestWith(jsonOfBytes(MAX_JSON_BYTES - 1)))).ok).toBe(true);
    expect((await parseJson(requestWith(jsonOfBytes(MAX_JSON_BYTES)))).ok).toBe(true);

    const over = await parseJson(requestWith(jsonOfBytes(MAX_JSON_BYTES + 1)));
    expect(over).toMatchObject({ ok: false, code: "VALIDATION", reason: "PAYLOAD_TOO_LARGE" });
    expect(over).not.toHaveProperty("field");

    const response = toResponse(over);
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(tooLargeEnvelope);
  });

  it.each([
    { name: "кириллица", unit: "я", width: 2 },
    { name: "эмодзи", unit: "😀", width: 4 },
    { name: "combining", unit: "e\u0301", width: 3 },
  ])("counts UTF-8 bytes, not characters ($name)", async ({ unit, width }) => {
    const atLimit = jsonOfBytes(MAX_JSON_BYTES, unit);
    expect(encoder.encode(atLimit).length).toBe(MAX_JSON_BYTES);
    expect((await parseJson(requestWith(atLimit))).ok).toBe(true);

    const over = jsonOfBytes(MAX_JSON_BYTES + width, unit);
    expect(encoder.encode(over).length).toBe(MAX_JSON_BYTES + width);
    const result = await parseJson(requestWith(over));
    expect(result).toMatchObject({ ok: false, reason: "PAYLOAD_TOO_LARGE" });
    expect(toResponse(result).status).toBe(413);
  });

  it("accepts a body without Content-Length", async () => {
    const result = await parseJson(streamRequest(streamOf([encoder.encode('{"a":"b"}')])));

    expect(result).toEqual({ ok: true, data: { a: "b" } });
  });

  it("cancels an oversized stream without Content-Length instead of reading it whole", async () => {
    let cancelled = 0;
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(1024));
      },
      cancel() {
        cancelled += 1;
      },
    });

    const result = await parseJson(streamRequest(stream));

    expect(result).toMatchObject({ ok: false, reason: "PAYLOAD_TOO_LARGE" });
    expect(cancelled).toBe(1);
    expect(pulls).toBeLessThanOrEqual(MAX_JSON_BYTES / 1024 + 2);
  });

  it("does not trust a Content-Length lower than the body", async () => {
    const body = jsonOfBytes(MAX_JSON_BYTES + 1);
    const response = toResponse(await parseJson(requestWith(body, { "content-length": "10" })));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual(tooLargeEnvelope);
  });

  it("refuses an over-limit Content-Length before reading the stream", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(4096));
      },
    });
    const request = streamRequest(stream, { "content-length": "40000" });

    const response = toResponse(await parseJson(request));

    expect(response.status).toBe(413);
    // Only the stream's own initial pull; a full read would need many more.
    expect(pulls).toBeLessThanOrEqual(1);
  });

  it("keeps 400 VALIDATION, without the size reason, for a malformed body under the limit", async () => {
    const response = toResponse(await parseJson(requestWith("{not json")));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
    });
  });
});

describe("guardRequestBody", () => {
  it("passes the same bytes, method, url and headers to the downstream handler", async () => {
    const body = JSON.stringify({ email: "a@example.com", note: "😀" });
    const guarded = await guardRequestBody(
      requestWith(body, { authorization: "Bearer t", "expo-origin": "giftlist://" }),
    );

    expect(guarded.ok).toBe(true);
    if (!guarded.ok) return;
    expect(guarded.request.method).toBe("POST");
    expect(guarded.request.url).toBe("http://x/");
    expect(guarded.request.headers.get("authorization")).toBe("Bearer t");
    expect(guarded.request.headers.get("expo-origin")).toBe("giftlist://");
    // Recomputed from the bytes actually read, so a lying header cannot survive.
    expect(guarded.request.headers.get("content-length")).toBe(String(encoder.encode(body).length));
    expect(await guarded.request.text()).toBe(body);
  });

  it("recomputes a lying Content-Length from the real bytes", async () => {
    const guarded = await guardRequestBody(requestWith('{"a":"b"}', { "content-length": "1" }));

    expect(guarded.ok).toBe(true);
    if (!guarded.ok) return;
    expect(guarded.request.headers.get("content-length")).toBe("9");
    expect(await guarded.request.text()).toBe('{"a":"b"}');
  });

  it("passes GET and HEAD through untouched", async () => {
    const get = new Request("http://x/api/auth/get-session", {
      headers: { cookie: "a=b" },
    });
    const head = new Request("http://x/api/auth/get-session", { method: "HEAD" });

    const guardedGet = await guardRequestBody(get);
    const guardedHead = await guardRequestBody(head);

    expect(guardedGet).toEqual({ ok: true, request: get });
    expect(guardedHead).toEqual({ ok: true, request: head });
  });

  it("answers 413 before the handler sees an oversized POST body", async () => {
    const guarded = await guardRequestBody(
      streamRequest(streamOf([encoder.encode("x".repeat(MAX_JSON_BYTES + 1))])),
    );

    expect(guarded.ok).toBe(false);
    if (guarded.ok) return;
    expect(guarded.response.status).toBe(413);
    expect(await guarded.response.json()).toEqual(tooLargeEnvelope);
  });
});
