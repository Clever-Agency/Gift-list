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
 * failures always keep their code's status.
 */
export function toResponse<T>(result: ActionResult<T>, successStatus = 200): Response {
  return Response.json(result, {
    status: result.ok ? successStatus : STATUS[result.code],
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
 * Reads a JSON body for a use-case that validates the shape itself (e.g. the
 * gift create/update actions). Only transport problems fail here: a wrong
 * content type, an oversized body or malformed JSON.
 */
export async function parseJson(request: Request): Promise<{ ok: true; data: unknown } | InvalidBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(contentType.trim())) return invalid();
  const declared = request.headers.get("content-length");
  if (declared != null && Number(declared) > MAX_JSON_BYTES) return invalid();
  let text: string;
  try {
    text = await request.text();
  } catch {
    return invalid();
  }
  if (text.length > MAX_JSON_BYTES) return invalid();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    return invalid();
  }
  return { ok: true, data: json };
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
