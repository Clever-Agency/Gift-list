import { notFoundResponse, toResponse } from "@/lib/api-v1";
import { cronAuthorized } from "@/lib/cron-auth";
import { processWishExpiry } from "@/lib/gift-status-store";

/**
 * Archive wishes whose date has passed. `OPEN` wishes are archived (Story 2.6);
 * an expired `RESERVED` wish is cleared and archived in one write unless the
 * gift is marked as bought, in which case only the holder's notice is queued.
 * A live reservation whose date is three days away queues the holder's «скоро»
 * notice (Story 6.6). The body carries counters only, no gift titles, ids or
 * people.
 */
export async function POST(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return toResponse({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  }
  try {
    const { archived, released, notifiedBought, remindedSoon, failed } = await processWishExpiry();
    // No server error code in the contract: an empty 500 keeps rows out of the body,
    // and a scheduler sees a partly failed run as failed.
    if (failed > 0) return new Response(null, { status: 500 });
    return toResponse({ ok: true, data: { archived, released, notifiedBought, remindedSoon } });
  } catch (error) {
    console.error(`wish-expiry: run failed: ${error instanceof Error ? error.name : "unknown"}`);
    return new Response(null, { status: 500 });
  }
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
