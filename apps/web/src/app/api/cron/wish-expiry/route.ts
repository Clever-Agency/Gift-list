import { notFoundResponse, toResponse } from "@/lib/api-v1";
import { cronAuthorized } from "@/lib/cron-auth";
import { processWishExpiry } from "@/lib/gift-status-store";

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
