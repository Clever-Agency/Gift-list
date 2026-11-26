import "server-only";

import type { ActionResult, TimeZoneBody } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";
import { canonicalTimeZone, knownTimeZone, storedTimeZone } from "@/lib/time-zone";

const invalidTimeZone = {
  ok: false as const,
  code: "VALIDATION" as const,
  message: "Invalid input",
  field: "timeZone",
};

/**
 * Stores the device IANA zone the first time it is missing.
 * An existing value, including `UTC`, is left as-is (Story 1.8, AD-23).
 * The explicit choice from settings goes through {@link changeTimeZone}.
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

/**
 * Story 7.2 (FR-37): the user's explicit choice in settings overwrites the
 * stored zone, unlike the device report above. Only a known IANA zone is
 * accepted: blank, unknown and non-string values are a `VALIDATION` on the
 * `timeZone` field, so the client can point at the control.
 */
export async function changeTimeZone(
  input: TimeZoneBody,
  headers: Headers,
): Promise<ActionResult<{ timeZone: string }>> {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Authentication required" };
  }
  const timeZone = knownTimeZone(input.timeZone);
  if (!timeZone) return invalidTimeZone;
  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!row) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Authentication required" };
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { timeZone },
  });
  return { ok: true, data: { timeZone } };
}
