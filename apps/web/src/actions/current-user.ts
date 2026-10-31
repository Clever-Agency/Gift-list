import "server-only";

import { meSchema, type ActionResult, type Me } from "@gift-list/contracts";
import { auth } from "@/lib/auth";

/**
 * Use-case "current user": shared by the `getMe` Server Action and `GET /api/v1/me`.
 * Takes the request headers (cookie or `Authorization: Bearer`).
 */
export async function getCurrentUser(headers: Headers): Promise<ActionResult<Me>> {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return { ok: false, code: "UNAUTHENTICATED", message: "Authentication required" };
  }
  const { id, email, name, nick } = session.user;
  return { ok: true, data: meSchema.parse({ id, email, name, nick }) };
}
