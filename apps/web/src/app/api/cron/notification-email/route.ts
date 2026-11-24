import { notFoundResponse, toResponse } from "@/lib/api-v1";
import { cronAuthorized } from "@/lib/cron-auth";
import { processNotificationEmails } from "@/lib/notification-email";

export async function POST(request: Request) {
  if (!cronAuthorized(request)) {
    return toResponse({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" });
  }
  try {
    const result = await processNotificationEmails();
    if (result.failed > 0) return new Response(null, { status: 500 });
    return toResponse({ ok: true, data: { sent: result.sent, expired: result.expired } });
  } catch (error) {
    console.error("notification-email: run failed", error instanceof Error ? error.name : "unknown");
    return new Response(null, { status: 500 });
  }
}

export const GET = notFoundResponse;
