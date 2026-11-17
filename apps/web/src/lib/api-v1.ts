import type { ActionResult, ErrorCode } from "@gift-list/contracts";
import type { z } from "zod";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 400,
  RATE_LIMITED: 429,
};

/**
 * Serialises a use-case result into the AD-12 JSON envelope with the mapped HTTP
 * status. A success is 200 unless the route created something, which is 201;
 * failures always keep their code's status, except an oversized body: the closed
 * `ErrorCode` set has no size code, so `reason: "PAYLOAD_TOO_LARGE"` carries the
 * 413 (the `reason` enum is the extensible part of the envelope).
 */
export function toResponse<T>(result: ActionResult<T>, successStatus = 200): Response {
  const status = result.ok
    ? successStatus
    : result.reason === "PAYLOAD_TOO_LARGE"
      ? 413
      : STATUS[result.code];
  return Response.json(result, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Infrastructure failure (for example, the database is unavailable): a bare 500
 * without the AD-12 envelope. The client treats a non-envelope body as a network
 * error, which is the sanctioned behavior from Story 1.4; the closed `ErrorCode`
 * set has no internal-error code.
 */
export function infrastructureErrorResponse(): Response {
  return new Response(null, {
    status: 500,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** Unknown path or method: the same envelope, so the client does not treat HTML or an empty body as `network`. */
export function notFoundResponse(request?: Request): Response {
  // The matched route is already unknown; the request only keeps the handler signature.
  void request;
  return toResponse({ ok: false, code: "NOT_FOUND", message: "Not found" });
}

/** First issue path joined with ".", or undefined when empty. */
export function firstIssueField(error: z.ZodError): string | undefined {
  const path = error.issues[0]?.path;
  return path && path.length > 0 ? path.map(String).join(".") : undefined;
}

/** First mutation bodies stay small; larger payloads are rejected before JSON.parse. */
export const MAX_JSON_BYTES = 32 * 1024;

type InvalidBody = Extract<ActionResult<never>, { ok: false }>;

function invalid(field?: string): InvalidBody {
  return {
    ok: false,
    code: "VALIDATION",
    message: "Invalid input",
    ...(field ? { field } : {}),
  };
}

/**
 * A body over {@link MAX_JSON_BYTES} keeps the AD-12 envelope: no `field`,
 * because the body may not even be JSON, and `reason` answers 413 (see
 * {@link toResponse}). The client maps the reason to `errors.reason.*`.
 */
function payloadTooLarge(): InvalidBody {
  return {
    ok: false,
    code: "VALIDATION",
    message: "Payload too large",
    reason: "PAYLOAD_TOO_LARGE",
  };
}

type BodyRead = { ok: true; bytes: Uint8Array<ArrayBuffer> } | { ok: false; tooLarge: boolean };

/**
 * Reads a request body only up to {@link MAX_JSON_BYTES}, counting real UTF-8
 * bytes as they arrive. The stream is cancelled as soon as the budget is
 * exceeded, so an oversized body is never buffered whole and never reaches
 * `JSON.parse`, a password hash, a rate-limit row or the database.
 *
 * `Content-Length` is only a cheap early refusal: it may be absent (chunked) or
 * lower than the actual body, so the stream stays the authority.
 */
async function readBodyBytes(request: Request): Promise<BodyRead> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const declaredBytes = Number(declared);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_JSON_BYTES) {
      return { ok: false, tooLarge: true };
    }
  }

  const body = request.body;
  if (body === null) return { ok: true, bytes: new Uint8Array(0) };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JSON_BYTES) {
        await reader.cancel();
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, tooLarge: false };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/**
 * Reads a JSON body for a use-case that validates the shape itself (e.g. the
 * gift create/update actions). Only transport problems fail here: a wrong
 * content type, an oversized body or malformed JSON.
 */
export async function parseJson(request: Request): Promise<{ ok: true; data: unknown } | InvalidBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(contentType.trim())) return invalid();
  const body = await readBodyBytes(request);
  if (!body.ok) return body.tooLarge ? payloadTooLarge() : invalid();
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(body.bytes)) as unknown;
  } catch {
    return invalid();
  }
  return { ok: true, data: json };
}

/**
 * Route-level guard for a handler that reads its own body (better-auth on
 * `/api/auth/[...all]`). Methods without a body pass through untouched; with a
 * body, the bytes are read under {@link MAX_JSON_BYTES} and handed on
 * **byte-for-byte** in a new `Request`, so the downstream handler sees exactly
 * the payload the client sent, but never an oversized one.
 *
 * `Content-Length` is recomputed from the bytes actually read, so a lying header
 * cannot survive into the handler.
 */
export async function guardRequestBody(
  request: Request,
): Promise<{ ok: true; request: Request } | { ok: false; response: Response }> {
  if (request.method === "GET" || request.method === "HEAD" || request.body === null) {
    return { ok: true, request };
  }
  const body = await readBodyBytes(request);
  if (!body.ok) {
    return { ok: false, response: toResponse(body.tooLarge ? payloadTooLarge() : invalid()) };
  }
  const headers = new Headers(request.headers);
  headers.set("content-length", String(body.bytes.byteLength));
  return {
    ok: true,
    request: new Request(request.url, {
      method: request.method,
      headers,
      body: body.bytes,
      signal: request.signal,
    }),
  };
}

/** Parses the JSON body with a contracts schema; failure is a VALIDATION result. */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | InvalidBody> {
  const parsed = await parseJson(request);
  if (!parsed.ok) return parsed;
  const result = schema.safeParse(parsed.data);
  if (!result.success) {
    return invalid(firstIssueField(result.error));
  }
  return { ok: true, data: result.data };
}
