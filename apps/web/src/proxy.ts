import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { allowedDevCorsOrigin, applyDevCors } from "@/lib/dev-cors";
import { getEnv } from "@/lib/env";

/**
 * Dev-only CORS for `/api/v1`, so Expo web on another localhost port can read
 * JSON responses (including credentialed fetches). Only `http(s)` origins listed in
 * `AUTH_DEV_TRUSTED_ORIGINS` are echoed; without the variable nothing is added.
 * Production returns before `getEnv()`, so the proxy never fails on env there.
 */
export function proxy(request: NextRequest) {
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
  matcher: "/api/v1/:path*",
};
