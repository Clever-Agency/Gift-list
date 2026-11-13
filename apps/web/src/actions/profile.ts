import "server-only";

import { listDataSchema, type ActionResult, type ListData } from "@gift-list/contracts";
import { readWishlist } from "@/actions/wishlist-read";
import { prisma } from "@/db/client";
import { isValidNick, normalizeNick } from "@/domain/nick";
import { auth } from "@/lib/auth";
import { requestLocale } from "@/lib/request-locale";
import {
  profileRelationFacts,
  readProfileInviteCooldown,
  readProfileRelationship,
  readProfileSubscription,
} from "@/lib/relationships";

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
 * relation facts stay behind the `relationshipReader` port, so a pending invite
 * is not a friendship for `VisibilityPolicy` (Story 4.1.1).
 *
 * `hideFromSearch` is deliberately not part of the lookup: search hides a
 * person, a direct `/u/:nick` profile does not (AD-13). Email, personal dates
 * and the share token of a stranger are never added here.
 *
 * Story 4.1.2 adds the viewer's closed relationship (`NONE`,
 * `OUTGOING_PENDING`, `INCOMING_PENDING`, `FRIENDS`) only to this answer. A
 * pending invite does not open FRIENDS wishes; `readWishlist` still decides that
 * from the accepted `Friendship` edge alone. A Block keeps the same closed
 * `not_found` body as an unknown nick, so no relationship, card or name leaks.
 *
 * Story 4.2.2 adds the profile-only live rejection cooldown. While the window is
 * open the relationship is forced to `NONE`: a rejection leaves no edge and no
 * pending invite, so neither `FRIENDS` nor `OUTGOING_PENDING` may be shown. The
 * cooldown never reaches `/l/:token` or `/me`, because those use-cases never add
 * the field.
 *
 * Story 4.6 adds one viewer-to-owner fact, `subscribed`, for the profile's
 * «Подписаться» / «Отписаться» switch. It is not a relationship and never
 * widens `readWishlist`: the subscriber still sees `PUBLIC` only (AD-19).
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

  const [relationship, inviteCooldown, subscribed, data] = await Promise.all([
    readProfileRelationship(session.user.id, owner.id),
    readProfileInviteCooldown(session.user.id, owner.id),
    // Story 4.6: one fact for the «Подписаться» / «Отписаться» switch. It never
    // widens the wishlist: `readWishlist` keeps deciding from its own facts.
    readProfileSubscription(session.user.id, owner.id),
    readWishlist({
      viewer: { id: session.user.id },
      target: { ownerId: owner.id },
      locale: requestLocale(headers.get("accept-language")),
    }),
  ]);
  // A Block hides the whole profile and must look exactly like a missing nick;
  // the relationship and the cooldown are discarded with the rest of the profile.
  if (data.access === "not_found") return { ok: true, data };

  return {
    ok: true,
    data: listDataSchema.parse({
      ...data,
      owner: { displayName: owner.name, nick: owner.nick },
      ...profileRelationFacts(relationship, inviteCooldown),
      subscribed,
    }),
  };
}
