import "server-only";

import type { ActionResult, MyProfile } from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { auth } from "@/lib/auth";
import { myProfileFromRow, myProfileSelect } from "@/lib/my-profile";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * CLE-129/T8.1 (D-58, AD-29): `GET /api/v1/me/profile` — the owner always sees
 * their own profile fields, including the visibility switch. The public
 * `/u/:nick` policy is a separate read (T8.2) and never uses this mapper.
 */
export async function getCurrentProfile(headers: Headers): Promise<ActionResult<MyProfile>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;
  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: myProfileSelect,
  });
  if (!row) return unauthenticated;
  return { ok: true, data: myProfileFromRow(row) };
}
