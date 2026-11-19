import { createHash, timingSafeEqual } from "node:crypto";

import { processWishExpiry } from "@/lib/gift-status-store";
import { notFoundResponse, toResponse } from "@/lib/api-v1";
import { getEnv } from "@/lib/env";

/**
 * Story 2.6 / AD-16: the external scheduler calls this once an hour. The secret
 * is compared as a hash so a wrong length does not throw and does not leak it.
 */
function cronAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${getEnv().CRON_SECRET}`;
  const actualHash = createHash("sha256").update(header).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

/** Archive open wishes whose date has passed. The body has no gift titles. */
export async function POST(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return toResponse({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  }
  try {
    const { archived, failed } = await processWishExpiry();
    // No server error code in the contract: an empty 500 keeps rows out of the body,
    // and a scheduler sees a partly failed run as failed.
    if (failed > 0) return new Response(null, { status: 500 });
    return toResponse({ ok: true, data: { archived } });
  } catch (error) {
    console.error(`wish-expiry: run failed: ${error instanceof Error ? error.name : "unknown"}`);
    return new Response(null, { status: 500 });
  }
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
