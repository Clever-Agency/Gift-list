import "server-only";

import { listDataSchema, type ActionResult, type ListData } from "@gift-list/contracts";
import { readWishlist } from "@/actions/wishlist-read";
import { prisma } from "@/db/client";
import { isValidNick, normalizeNick } from "@/domain/nick";
import { auth } from "@/lib/auth";
import { requestLocale } from "@/lib/request-locale";

const unauthenticated = {
  ok: false as const,
  code: "UNAUTHENTICATED" as const,
  message: "Authentication required",
};

/** The closed answer for every gate: unknown, old, malformed or blocked nick. */
const notFound: ListData = { access: "not_found", gifts: [] };

/**
 * Story 3.4.1 (AD-7, AD-13): a signed-in user opens somebody's profile by nick.
 *
 * The nick is compared only in its canonical `nickNormalized` form, so case does
 * not matter and a nick left behind by a rename simply does not resolve. Every
 * miss — unknown, old, malformed, a path with a slash or a Block — answers the
 * same closed `not_found` without a name, an email or any gift.
 *
 * The gifts are read only through `readWishlist` with `target: { ownerId }` and
 * without `viaListToken`, so `PUBLIC` follows the relation facts and never
 * opens as if the viewer had arrived through `/l/:publicToken` (AD-7). The
 * relation facts stay behind the `relationshipReader` port; the pre-Epic-4
 * adapter answers "no relation", and Epic 4/8 replace it without touching this
 * action.
 *
 * `hideFromSearch` is deliberately not part of the lookup: search hides a
 * person, a direct `/u/:nick` profile does not (AD-13). Email, personal dates
 * and the share token of a stranger are never added here.
 */
export async function getProfileByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<ListData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const nickNormalized = normalizeNick(nick);
  if (!isValidNick(nickNormalized)) return { ok: true, data: listDataSchema.parse(notFound) };

  const owner = await prisma.user.findUnique({
    where: { nickNormalized },
    select: { id: true, name: true, nick: true },
  });
  if (owner === null) return { ok: true, data: listDataSchema.parse(notFound) };

  const data = await readWishlist({
    viewer: { id: session.user.id },
    target: { ownerId: owner.id },
    locale: requestLocale(headers.get("accept-language")),
  });
  // A Block hides the whole profile and must look exactly like a missing nick.
  if (data.access === "not_found") return { ok: true, data };

  return {
    ok: true,
    data: listDataSchema.parse({
      ...data,
      owner: { displayName: owner.name, nick: owner.nick },
    }),
  };
}
