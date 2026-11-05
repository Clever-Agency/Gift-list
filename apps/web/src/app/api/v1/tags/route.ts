import { getTagCatalog } from "@/actions/tags";
import { infrastructureErrorResponse, notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * Story 2.5 / AD-22 / AD-27: fixed tag catalog with a label on the request
 * language. Public read: the catalog has no user data and depends only on
 * `Accept-Language`, so there is no session check. The route always reads the
 * database (no shared cache lifetime); the envelope is `private, no-store`, and
 * `Vary` states the language dependency for any intermediary that inspects it.
 *
 * A database or other internal failure is a bare 500 without the AD-12 envelope:
 * the client treats a non-envelope body as `network`, so an outage is not shown
 * as "not found".
 */
export async function GET(request: Request) {
  let response: Response;
  try {
    response = toResponse(await getTagCatalog(request.headers));
  } catch (error) {
    console.error("Tag catalog read failed", error);
    response = infrastructureErrorResponse();
  }
  response.headers.set("Vary", "Accept-Language");
  return response;
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
