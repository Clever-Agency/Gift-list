import "server-only";

import type { ActionResult, TimeZoneBody } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";
import { canonicalTimeZone, storedTimeZone } from "@/lib/time-zone";

/**
 * Stores the device IANA zone the first time it is missing.
 * An existing value, including `UTC`, is left as-is (Story 1.8, AD-23).
 */
export async function setTimeZone(
  input: TimeZoneBody,
  headers: Headers,
): Promise<ActionResult<{ timeZone: string }>> {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Authentication required" };
  }
  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timeZone: true },
  });
  if (!row) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Authentication required" };
  }
  const current = storedTimeZone(row.timeZone);
  if (current) return { ok: true, data: { timeZone: current } };

  const timeZone = canonicalTimeZone(input.timeZone);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { timeZone },
  });
  return { ok: true, data: { timeZone } };
}
