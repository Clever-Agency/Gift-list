import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { allowedExpoWebDevOrigin, applyDevCors } from "@/lib/dev-cors";

/**
 * Dev-only CORS for `/api/v1`, so Expo web on another localhost port can read
 * JSON responses (including credentialed fetches). Production adds nothing.
 */
export function proxy(request: NextRequest) {
  const origin = allowedExpoWebDevOrigin(request.headers.get("origin"), process.env.NODE_ENV);
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
