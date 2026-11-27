import { notFoundResponse, toResponse } from "@/lib/api-v1";
import { cronAuthorized } from "@/lib/cron-auth";
import { processDateReminders } from "@/lib/date-reminders-store";
import { isSchemaNotMigrated } from "@/lib/schema-not-migrated";

/**
 * Story 7.3 (FR-34, AD-16, AD-23): the hourly date-reminders cron sends the
 * T-14 notice about a Friend's birthday. The body carries counters only, no
 * names, nicks, titles or ids.
 *
 * Until the migrations of CLE-137/CLE-138 reach a deployment, its database
 * answers `P2021` (missing `ReminderLog`) or `P2022` (missing
 * `remindFriendDates`). Such a run is skipped with a 200 and a fixed marker, not
 * a 500: the scheduler runs from the staging branch and calls production too,
 * where the code can arrive before the next migration deploy.
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
    const { sent, failed } = await processDateReminders();
    // No server error code in the contract: an empty 500 keeps rows out of the
    // body, and a scheduler sees a partly failed run as failed.
    if (failed > 0) return new Response(null, { status: 500 });
    return toResponse({ ok: true, data: { sent } });
  } catch (error) {
    if (isSchemaNotMigrated(error)) {
      console.error("date-reminders: schema not migrated, skipped");
      return toResponse({ ok: true, data: { skipped: "schema" } });
    }
    console.error(`date-reminders: run failed: ${error instanceof Error ? error.name : "unknown"}`);
    return new Response(null, { status: 500 });
  }
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
