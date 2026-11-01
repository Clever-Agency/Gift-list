import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/db/client";

export const REGISTER_LIMIT = { max: 5, windowSeconds: 60 * 60 } as const;

/** Client IP as set by the hosting proxy (Vercel puts the real client first). */
export function clientIp(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/** Client IP from the current Next.js request headers. */
export async function getClientIp(): Promise<string> {
  return clientIp(await headers());
}

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Fixed-window counter in Postgres. The upsert is a single atomic statement,
 * so concurrent requests cannot both slip under the limit.
 * A denied call does not move `windowStart`: further attempts wait out the same window.
 */
export async function consumeRateLimit(
  key: string,
  { max, windowSeconds }: { max: number; windowSeconds: number },
): Promise<RateLimitDecision> {
  const rows = await prisma.$queryRaw<{ count: number; retryAfterSeconds: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
        THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
        THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING
      "count"::int AS "count",
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${windowSeconds}) - now())))
      )::int AS "retryAfterSeconds"`;
  const row = rows[0];
  if (!row || row.count <= max) return { allowed: true };
  return { allowed: false, retryAfterSeconds: row.retryAfterSeconds };
}
