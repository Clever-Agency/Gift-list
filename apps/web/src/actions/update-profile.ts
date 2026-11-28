import "server-only";

import {
  myProfileSchema,
  type ActionResult,
  type MyProfile,
  type ProfileUpdateBody,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import { profileFieldsForWrite } from "@/domain/profile";
import { auth } from "@/lib/auth";
import { myProfileFromRow, myProfileSelect } from "@/lib/my-profile";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/**
 * CLE-129/T8.1 (D-58, AD-29): `PATCH /api/v1/me/profile` writes the profile
 * fields of the current user and answers the whole `MyProfile`, so the screen
 * puts the server value in place without a reload.
 *
 * The contract already checked the body; the domain repeats the pair and the
 * calendar rules for direct callers, then names the offending field for the
 * screen. A body that changes nothing is a successful no-op and writes no row.
 * The name, the nick and the email are not touched here: they keep their own
 * routes (D-59, T7).
 */
export async function updateProfile(
  input: ProfileUpdateBody,
  headers: Headers,
): Promise<ActionResult<MyProfile>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;
  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: myProfileSelect,
  });
  if (!row) return unauthenticated;

  const current = myProfileFromRow(row);
  const prepared = profileFieldsForWrite(input);
  if (!prepared.ok) {
    return { ok: false, code: "VALIDATION", message: "Invalid input", field: prepared.field };
  }
  if (Object.keys(prepared.data).length === 0) return { ok: true, data: current };

  await prisma.user.update({ where: { id: row.id }, data: prepared.data });
  return { ok: true, data: myProfileSchema.parse({ ...current, ...prepared.data }) };
}
