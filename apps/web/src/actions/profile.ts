import "server-only";

import {
  listDataSchema,
  notFoundError,
  type ActionResult,
  type ListData,
} from "@gift-list/contracts";
import { readWishlist } from "@/actions/wishlist-read";
import { prisma } from "@/db/client";
import { isValidNick, normalizeNick } from "@/domain/nick";
import { visiblePersonalDates } from "@/domain/personal-dates";
import { profileDetailsFor } from "@/domain/profile-details";
import { auth } from "@/lib/auth";
import { readPersonalDates } from "@/lib/personal-dates-store";
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

/**
 * Story 3.4.1 (AD-7, AD-13): a signed-in user opens somebody's profile by nick.
 *
 * The nick is compared only in its canonical `nickNormalized` form, so case does
 * not matter and a nick left behind by a rename simply does not resolve. Every
 * miss — unknown, old, malformed, a path with a slash or a Block — answers the
 * same HTTP 404 `NOT_FOUND` refusal (AD-12 ред. 2026-11-17) without a name, an
 * email or any gift.
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
 * `NOT_FOUND` body as an unknown nick, so no relationship, card or name leaks.
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
 *
 * CLE-129/T8.2 (AD-7 ред. 2026-11-26, AD-29) adds the optional `details` block.
 * `canSeeProfileDetails` decides from the accepted `Friendship` alone: the owner
 * always gets their fields plus the switch, an accepted friend gets them only
 * while `profileVisibleToFriends` is on, and every other viewer gets no key at
 * all. A Block is already the closed 404, so it never reaches the block. The
 * relation is taken from the raw relationship read, not from the cooldown-adjusted
 * button facts: a live rejection cooldown is a button state, not a lost friendship.
 *
 * CLE-141/Story 7.5 (AD-23) adds the visible personal dates through the same
 * one profile read. The stored rows come from `readPersonalDates`, and
 * `visiblePersonalDates` decides with the same relation facts as the fields:
 * the owner gets every own date, an accepted friend also `FRIENDS`, a
 * subscriber only `EVERYONE` (AD-15-10), and a blocked pair already answered the
 * closed 404 before this block. `viaListToken` is false here by construction —
 * `/l/:token` never reaches this use-case and never carries dates.
 */
export async function getProfileByNick(
  nick: string,
  headers: Headers,
): Promise<ActionResult<ListData>> {
  const session = await auth.api.getSession({ headers });
  if (!session) return unauthenticated;

  const nickNormalized = normalizeNick(nick);
  if (!isValidNick(nickNormalized)) return notFoundError();

  const owner = await prisma.user.findUnique({
    where: { nickNormalized },
    select: {
      id: true,
      name: true,
      nick: true,
      // AD-29: read here and nowhere else for `/u/:nick`; the policy below decides
      // whether they travel. The switch itself is answered only to the owner.
      birthDay: true,
      birthMonth: true,
      gender: true,
      country: true,
      about: true,
      profileVisibleToFriends: true,
    },
  });
  if (owner === null) return notFoundError();

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
  if (data === null) return notFoundError();

  // AD-23: at most ten rows; the policy below drops the ones this viewer may
  // not see and hides a year the owner did not open. The read happens after the
  // closed 404, so a blocked pair never even asks for the dates.
  const dates = await readPersonalDates(owner.id);

  // AD-7 / AD-29: `undefined` keeps the key out of the answer entirely.
  const details = profileDetailsFor(
    { id: session.user.id },
    { id: owner.id, profileVisibleToFriends: owner.profileVisibleToFriends },
    // An accepted `Friendship` is exactly what `readProfileRelationship` reports
    // before the cooldown composition; a pending invite never is a friendship.
    { friend: relationship === "FRIENDS" },
    owner,
  );
  const visibleDates = visiblePersonalDates(
    { id: session.user.id },
    {
      // A Block was already the closed 404 above, before any date could travel.
      blocked: false,
      friend: relationship === "FRIENDS",
      subscriber: subscribed,
      contactMatch: false,
      // `/u/:nick` is not a link visit; `viaListToken` is always false here.
      viaListToken: false,
    },
    dates,
  );

  return {
    ok: true,
    data: listDataSchema.parse({
      ...data,
      owner: { displayName: owner.name, nick: owner.nick },
      ...profileRelationFacts(relationship, inviteCooldown),
      subscribed,
      ...(details === undefined ? {} : { details }),
      ...(visibleDates.length === 0 ? {} : { dates: visibleDates }),
    }),
  };
}
