import { notFoundResponse, toResponse } from "@/lib/api-v1";
import { cronAuthorized } from "@/lib/cron-auth";
import { processReservationTimers } from "@/lib/gift-status-store";

/**
 * Story 5.6 (AD-9, AD-16, ARCH-A15): the hourly reservation cycle. The same
 * secret and the same timing-safe check as `/api/cron/wish-expiry`; the run moves
 * a row at most one phase (72 h, then 168 h) and releases only a reservation the
 * holder did not mark as bought.
 *
 * The answer carries the three counters and nothing else — no ids, titles, nicks
 * or moments. A partly failed run is an empty 500, so the scheduler sees it as
 * failed without the body naming any row.
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
    const { expiredToGiver, askedOwner, released, failed } = await processReservationTimers();
    if (failed > 0) return new Response(null, { status: 500 });
    return toResponse({ ok: true, data: { expiredToGiver, askedOwner, released } });
  } catch (error) {
    console.error(
      `reservation-timers: run failed: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return new Response(null, { status: 500 });
  }
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
