import "server-only";

import { listDataSchema, type ActionResult, type ListData } from "@gift-list/contracts";
import { readWishlist } from "@/actions/wishlist-read";
import { prisma } from "@/db/client";
import { isValidNick, normalizeNick } from "@/domain/nick";
import { auth } from "@/lib/auth";
import { requestLocale } from "@/lib/request-locale";
import { readProfileInviteCooldown, readProfileRelationship } from "@/lib/relationships";

/** The closed answer for every gate: unknown, old, malformed or blocked nick. */
const notFound: ListData = { access: "not_found", gifts: [] };

/**
 * Story 3.4.1 (AD-7, AD-13): a profile by nick. The page is public: without a
 * session it answers the owner card and the `PUBLIC` wishes, exactly like a link
 * visitor, and never `FRIENDS` or `SECRET`. A stale token is simply no session.
 *
 * The nick is compared only in its canonical `nickNormalized` form, so case does
 * not matter and a nick left behind by a rename simply does not resolve. Every
 * miss — unknown, old, malformed, a path with a slash or a Block — answers the
 * same closed `not_found` without a name, an email or any gift.
 *
 * A signed-in read still goes through `readWishlist` with `target: { ownerId }`
 * and without `viaListToken`, so `PUBLIC` follows the relation facts. A public
 * guest read adds `viaPublicProfile`, which opens only `PUBLIC` — the same
 * matrix as the link token (AD-7). The relation facts stay behind the
 * `relationshipReader` port, so a pending invite is not a friendship for
 * `VisibilityPolicy` (Story 4.1.1).
 *
 * `hideFromSearch` is deliberately not part of the lookup: search hides a
 * person, a direct `/u/:nick` profile does not (AD-13). Email, personal dates
 * and the share token of a stranger are never added here.
 *
 * Story 4.1.2 adds the viewer's closed relationship (`NONE`,
 * `OUTGOING_PENDING`, `INCOMING_PENDING`, `FRIENDS`) only to a signed-in
 * answer. A pending invite does not open FRIENDS wishes; `readWishlist` still
 * decides that from the accepted `Friendship` edge alone. A Block keeps the same
 * closed `not_found` body as an unknown nick, so no relationship, card or name leaks.
 *
 * Story 4.2.2 adds the profile-only live rejection cooldown to a signed-in
 * answer. While the window is open the relationship is forced to `NONE`: a
 * rejection leaves no edge and no pending invite, so neither `FRIENDS` nor
 * `OUTGOING_PENDING` may be shown. The cooldown never reaches `/l/:token` or
 * `/me`, because those use-cases never add the field.
 */
export async function getProfileByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<ListData>> {
  const session = await auth.api.getSession({ headers });
  const viewer = session ? { id: session.user.id } : null;

  const nickNormalized = normalizeNick(nick);
  if (!isValidNick(nickNormalized)) return { ok: true, data: listDataSchema.parse(notFound) };

  const owner = await prisma.user.findUnique({
    where: { nickNormalized },
    select: { id: true, name: true, nick: true },
  });
  if (owner === null) return { ok: true, data: listDataSchema.parse(notFound) };

  const [relationship, inviteCooldown, data] = await Promise.all([
    viewer ? readProfileRelationship(viewer.id, owner.id) : Promise.resolve("NONE"),
    viewer ? readProfileInviteCooldown(viewer.id, owner.id) : Promise.resolve(null),
    readWishlist({
      viewer,
      target: { ownerId: owner.id },
      // A guest profile is a public discovery read: PUBLIC wishes only.
      viaPublicProfile: viewer === null,
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
      // A guest has no relation facts of their own: the answer stays closed.
      ...(viewer
        ? { relationship: inviteCooldown === null ? relationship : "NONE" }
        : {}),
      ...(viewer && inviteCooldown !== null ? { inviteCooldown } : {}),
    }),
  };
}
