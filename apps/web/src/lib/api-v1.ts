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

/** Serialises a use-case result into the AD-12 JSON envelope with the mapped HTTP status. */
export function toResponse<T>(result: ActionResult<T>): Response {
  return Response.json(result, {
    status: result.ok ? 200 : STATUS[result.code],
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** First issue path joined with ".", or undefined when empty. */
export function firstIssueField(error: z.ZodError): string | undefined {
  const path = error.issues[0]?.path;
  return path && path.length > 0 ? path.map(String).join(".") : undefined;
}

/** Parses the JSON body with a contracts schema; failure is a VALIDATION result. */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | Extract<ActionResult<never>, { ok: false }>> {
  const invalid = (field?: string) => ({
    ok: false as const,
    code: "VALIDATION" as const,
    message: "Invalid input",
    ...(field ? { field } : {}),
  });
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(contentType.trim())) return invalid();
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalid();
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return invalid(firstIssueField(parsed.error));
  }
  return { ok: true, data: parsed.data };
}
