import { hideFromSearchUpdateBodySchema } from "@gift-list/contracts";
import { updateHideFromSearch } from "@/actions/update-hide-from-search";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";

export async function PATCH(request: Request) {
  const parsed = await parseJsonBody(request, hideFromSearchUpdateBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await updateHideFromSearch(parsed.data, request.headers));
}

export const GET = notFoundResponse;
export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
