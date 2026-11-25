import { getAppVersionPolicy } from "@/actions/app-version";
import { infrastructureErrorResponse, notFoundResponse, toResponse } from "@/lib/api-v1";

/**
 * CLE-86: public `GET /api/v1/app-version` with the update policy for Android
 * and iOS. The answer carries no user data and reads no database, so there is no
 * session check. `toResponse` sets the AD-12 envelope and `private, no-store`:
 * the body is tiny, and a cached answer could delay a newly raised
 * `minSupportedVersion`.
 *
 * Broken policy constants are not a "not found": the use-case throws and this
 * route answers a bare 500 without the envelope, which the native client treats
 * as a network failure and fails open.
 */
export async function GET() {
  let response: Response;
  try {
    response = toResponse(await getAppVersionPolicy());
  } catch (error) {
    console.error("App version policy read failed", error);
    response = infrastructureErrorResponse();
  }
  return response;
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
