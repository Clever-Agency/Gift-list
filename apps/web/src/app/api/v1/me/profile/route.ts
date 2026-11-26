import { profileUpdateBodySchema } from "@gift-list/contracts";
import { getCurrentProfile } from "@/actions/current-profile";
import { updateProfile } from "@/actions/update-profile";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";

/**
 * CLE-129/T8.1 (D-58, AD-29): the current user's profile fields. `GET` answers
 * them always for the owner; `PATCH` is the one write (the public `/u/:nick`
 * read stays in T8.2). The body is checked by the shared contract, then the
 * use-case owns the session, the domain checks and the write.
 */
export async function GET(request: Request) {
  return toResponse(await getCurrentProfile(request.headers));
}

export async function PATCH(request: Request) {
  const parsed = await parseJsonBody(request, profileUpdateBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await updateProfile(parsed.data, request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
