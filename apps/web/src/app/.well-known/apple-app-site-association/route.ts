import { appleAppSiteAssociation } from "@/lib/app-links";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const body = appleAppSiteAssociation(getEnv().APPLE_TEAM_ID);
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
