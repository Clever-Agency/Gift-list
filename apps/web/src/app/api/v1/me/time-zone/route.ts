import { timeZoneBodySchema } from "@gift-list/contracts";
import { setTimeZone } from "@/actions/set-time-zone";
import { parseJsonBody, toResponse } from "@/lib/api-v1";

export async function PUT(request: Request) {
  const parsed = await parseJsonBody(request, timeZoneBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await setTimeZone(parsed.data, request.headers));
}
