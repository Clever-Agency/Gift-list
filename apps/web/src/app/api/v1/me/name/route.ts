import { nameUpdateBodySchema } from "@gift-list/contracts";
import { updateName } from "@/actions/update-name";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";

/**
 * CLE-129/D-59: `/profile` changes the display name. The route follows
 * `/me/nick`: the body is checked by the shared contract (AD-12/AD-13), the
 * use-case owns the session and the write, and `PATCH` is the one method.
 */
export async function PATCH(request: Request) {
  const parsed = await parseJsonBody(request, nameUpdateBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await updateName(parsed.data, request.headers));
}

export const GET = notFoundResponse;
export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
