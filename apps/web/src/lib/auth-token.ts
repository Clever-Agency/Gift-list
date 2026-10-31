const TOKEN_HEADER = "set-auth-token";
const EXPOSE_HEADER = "access-control-expose-headers";

function isNative(request: Request): boolean {
  return (
    request.headers.has("expo-origin") ||
    (request.headers.get("origin") ?? "").startsWith("giftlist://")
  );
}

/**
 * bearer() adds `set-auth-token` to every response that sets the session cookie.
 * Keep it for native requests only so same-origin browser JS cannot read the token.
 */
export function stripAuthTokenForBrowser(request: Request, response: Response): Response {
  if (isNative(request) || !response.headers.has(TOKEN_HEADER)) return response;
  const headers = new Headers(response.headers);
  headers.delete(TOKEN_HEADER);
  const exposed = (headers.get(EXPOSE_HEADER) ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && name.toLowerCase() !== TOKEN_HEADER);
  if (exposed.length > 0) headers.set(EXPOSE_HEADER, exposed.join(", "));
  else headers.delete(EXPOSE_HEADER);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
