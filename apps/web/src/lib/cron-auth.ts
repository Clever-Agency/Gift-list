import { createHash, timingSafeEqual } from "node:crypto";

import { getEnv } from "@/lib/env";

/**
 * Story 2.6 / Story 5.6 / AD-16: the external scheduler authenticates with
 * `Authorization: Bearer ${CRON_SECRET}`. Both values are hashed first, so a
 * wrong length never makes `timingSafeEqual` throw and a near miss cannot be
 * told apart from a wholly wrong secret by the response time. The secret is
 * never logged.
 */
export function cronAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${getEnv().CRON_SECRET}`;
  const actualHash = createHash("sha256").update(header).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}
