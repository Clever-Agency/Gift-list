import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ERROR_CODES } from "@gift-list/contracts";
import { parseJsonBody, toResponse } from "./api-v1";

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

describe("parseJsonBody", () => {
  const schema = z.object({ email: z.string(), n: z.number() });
  const req = (body: string) => new Request("http://x/", {
      method: "POST",
      body,
      headers: { "content-type": "application/json; charset=utf-8" },
    });

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
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(r).not.toHaveProperty("field");
  });

  it("rejects schema failure with the first path as field", async () => {
    expect(await parseJsonBody(req('{"email":"a","n":"x"}'), schema)).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "n",
    });
  });
});
