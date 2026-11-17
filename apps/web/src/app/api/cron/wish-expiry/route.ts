import { createHash, timingSafeEqual } from "node:crypto";

import { GiftStatusService } from "@/domain/gift-status";
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
  const archived = await new GiftStatusService().processWishExpiry();
  return toResponse({ ok: true, data: archived });
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
