import { notFoundResponse, toResponse } from "@/lib/api-v1";
import { cronAuthorized } from "@/lib/cron-auth";
import { processReservationTimers } from "@/lib/gift-status-store";

/**
 * Story 5.6 (AD-9, AD-16, ARCH-A15): the hourly reservation cycle. The same
 * secret and the same timing-safe check as `/api/cron/wish-expiry`; the run moves
 * a row at most one phase (72 h, then 168 h) and releases a reservation whose
 * deadline is at least 168 hours old — whatever its phase and whether or not the
 * holder marked it as bought (CLE-124/S9b-1). The `AWAITING_OWNER` phase is
 * internal: the owner is never asked and never notified (CLE-124/D-49).
 *
 * The answer carries the counters and nothing else — no ids, titles, nicks or
 * moments. CLE-124/S9b-2 adds `reminded` for the reminder 1–2 days before the
 * deadline; the other counters keep their names. A partly failed run is an empty
 * 500, so the scheduler sees it as failed without the body naming any row.
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
    const { expiredToGiver, toAwaitingOwner, released, reminded, failed } = await processReservationTimers();
    if (failed > 0) return new Response(null, { status: 500 });
    return toResponse({ ok: true, data: { expiredToGiver, toAwaitingOwner, released, reminded } });
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
