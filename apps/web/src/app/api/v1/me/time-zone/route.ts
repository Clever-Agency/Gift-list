import { timeZoneBodySchema } from "@gift-list/contracts";
import { changeTimeZone, setTimeZone } from "@/actions/set-time-zone";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";

/**
 * Story 1.8 (FR-37): the device reports its zone; the first value is stored and
 * an existing one is never overwritten. Story 7.2 adds `PATCH` for the explicit
 * choice in settings, which does overwrite the stored zone.
 */
export async function PUT(request: Request) {
  const parsed = await parseJsonBody(request, timeZoneBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await setTimeZone(parsed.data, request.headers));
}

export async function PATCH(request: Request) {
  const parsed = await parseJsonBody(request, timeZoneBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await changeTimeZone(parsed.data, request.headers));
}

export const GET = notFoundResponse;
export const POST = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
