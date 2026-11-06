import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { allowedDevCorsOrigin, applyDevCors } from "@/lib/dev-cors";
import { getEnv } from "@/lib/env";
import { PUBLIC_LOCALE_HEADER, requestLocale } from "@/lib/request-locale";

/**
 * Story 3.3 / AD-27: the language of a public link document is negotiated from
 * `Accept-Language` and forwarded to the root layout through an internal request
 * header. Only `/l/*` is marked, so every other page keeps the default `ru` and
 * its own caching behaviour. The header is not exposed to the client.
 */
function publicPageRequest(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname !== "/l" && !pathname.startsWith("/l/")) return null;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    PUBLIC_LOCALE_HEADER,
    requestLocale(request.headers.get("accept-language")),
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Dev-only CORS for `/api/v1`, so Expo web on another localhost port can read
 * JSON responses (including credentialed fetches). Only `http(s)` origins listed in
 * `AUTH_DEV_TRUSTED_ORIGINS` are echoed; without the variable nothing is added.
 * Production returns before `getEnv()`, so the proxy never fails on env there.
 */
export function proxy(request: NextRequest) {
  const publicPage = publicPageRequest(request);
  if (publicPage !== null) return publicPage;

  const nodeEnv = process.env.NODE_ENV;
  const requestOrigin = request.headers.get("origin");
  if (nodeEnv === "production" || !requestOrigin) return NextResponse.next();
  const origin = allowedDevCorsOrigin(requestOrigin, getEnv().AUTH_DEV_TRUSTED_ORIGINS, nodeEnv);
  if (!origin) return NextResponse.next();

  if (request.method === "OPTIONS") {
    const headers = new Headers();
    applyDevCors(headers, origin);
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  applyDevCors(response.headers, origin);
  return response;
}

export const config = {
  matcher: ["/api/v1/:path*", "/l/:path*"],
};
