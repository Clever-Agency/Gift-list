import type { ActionResult } from "@gift-list/contracts";
import { toResponse } from "@/lib/api-v1";

const TOKEN_HEADER = "set-auth-token";

/** Same criterion as `stripAuthTokenForBrowser`: the token stays off browser JS. */
export function isNativeAuthRequest(request: Request): boolean {
  return (
    request.headers.has("expo-origin") ||
    (request.headers.get("origin") ?? "").startsWith("giftlist://")
  );
}

/**
 * JSON envelope plus the session cookie. `set-auth-token` is copied only for a native request.
 */
export function withAuthSession<T>(
  request: Request,
  session: Response,
  result: ActionResult<T>,
): Response {
  const json = toResponse(result);
  const headers = new Headers(json.headers);
  const cookies =
    typeof session.headers.getSetCookie === "function" ? session.headers.getSetCookie() : [];
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  if (isNativeAuthRequest(request)) {
    const token = session.headers.get(TOKEN_HEADER);
    if (token) {
      headers.set(TOKEN_HEADER, token);
      const exposed = headers.get("access-control-expose-headers");
      headers.set(
        "access-control-expose-headers",
        exposed ? `${exposed}, ${TOKEN_HEADER}` : TOKEN_HEADER,
      );
    }
  }
  return new Response(json.body, { status: json.status, headers });
}
