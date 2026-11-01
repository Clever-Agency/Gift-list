import { assetLinks, parseFingerprints } from "@/lib/app-links";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const body = assetLinks(parseFingerprints(getEnv().ANDROID_SHA256_CERT_FINGERPRINTS));
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
