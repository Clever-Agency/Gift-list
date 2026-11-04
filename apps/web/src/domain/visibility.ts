// AD-7 — the single gate for every wishlist / gift-card read.
// Rules only: no Prisma, no React/Next.js here (AD-1). Callers map their row to
// `VisibilityGift` and hand the caller identity plus its relation facts over as
// `VisibilityViewer` / `ViewerRelations`.

/** Closed `Gift.visibility` set (AD-7). */
export type GiftVisibility = "PUBLIC" | "FRIENDS" | "SECRET";

/** The person asking for a list or a gift card; `null` is an anonymous visitor. */
export type VisibilityViewer = { readonly id: string } | null;

/**
 * What the platform knows about the viewer's relation to the list owner. The
 * domain never looks these up itself — the caller gathers them from outside:
 *
 * - `blocked` — a `Block` edge in either direction (AD-10, Epic 4);
 * - `friend` — an accepted `Friendship` (AD-10, Epic 4);
 * - `subscriber` — a `Subscription` to the owner (AD-19);
 * - `contactMatch` — a `ContactMatch` edge for the viewer's phone (AD-18, Epic 8);
 * - `viaListToken` — the viewer arrived through `/l/:publicToken` (Story 3.3).
 */
export type ViewerRelations = {
  readonly blocked: boolean;
  readonly friend: boolean;
  readonly subscriber: boolean;
  readonly contactMatch: boolean;
  readonly viaListToken: boolean;
};

/** No relation facts at all; safe default for callers that have nothing else. */
export const NO_RELATIONS: ViewerRelations = {
  blocked: false,
  friend: false,
  subscriber: false,
  contactMatch: false,
  viaListToken: false,
};

/**
 * Port that answers the relation facts for one viewer/owner pair (AD-7, AD-10,
 * AD-18, AD-19). The domain stays free of Prisma: the server adapter behind this
 * interface owns every table lookup.
 *
 * `viaListToken` is deliberately absent — only the caller knows whether the
 * viewer arrived through `/l/:publicToken`, so the caller adds that fact itself.
 */
export interface RelationshipReader {
  relationsBetween(
    viewerId: string | null,
    ownerId: string,
  ): Promise<Omit<ViewerRelations, "viaListToken">>;
}

/** The minimum gift data the gate needs; keeps Prisma rows out of the domain. */
export type VisibilityGift = {
  readonly ownerId: string;
  readonly visibility: GiftVisibility;
  readonly archivedAt: Date | null;
};

/** The list data the gate needs; `null` means the list row was not found. */
export type VisibilityList = { readonly ownerId: string };

/** Which branch the viewer took: own list, or someone else's (AD-7). */
export type ViewerRole = "owner" | "viewer";

/**
 * Closed list-read answer (AD-7 / AD-12): a gate never explains itself, so the
 * result carries no hidden counts, names, or flags — only the access decision,
 * the visible gifts, and the viewer's role.
 */
export type VisibilityResult<T extends VisibilityGift> =
  | { readonly access: "not_found"; readonly gifts: readonly []; readonly role: null }
  | { readonly access: "gifts"; readonly gifts: readonly T[]; readonly role: ViewerRole };

/**
 * May `viewer` see `gift`? AD-7 matrix:
 *
 * - the owner sees every own gift, including `SECRET` and archived ones;
 * - a block hides the whole list before any per-gift rule;
 * - archived gifts are owner-only;
 * - `SECRET` is owner-only, `FRIENDS` needs an accepted friendship;
 * - `PUBLIC` also opens for a subscriber, a contact match, or a list-token
 *   visitor; an anonymous viewer needs the list token and nothing else.
 */
function canSee(
  viewer: VisibilityViewer,
  relations: ViewerRelations,
  gift: VisibilityGift,
): boolean {
  if (viewer !== null && viewer.id === gift.ownerId) return true;
  if (relations.blocked) return false;
  if (gift.archivedAt !== null) return false;
  if (gift.visibility === "SECRET") return false;

  if (gift.visibility === "FRIENDS") {
    return viewer !== null && relations.friend;
  }

  // PUBLIC: an anonymous visitor only counts when they hold the list token.
  if (viewer === null) return relations.viaListToken;
  return (
    relations.friend ||
    relations.subscriber ||
    relations.contactMatch ||
    relations.viaListToken
  );
}

export const VisibilityPolicy = {
  canSee,

  /**
   * Resolve a whole list read (AD-7 steps 1–3). A missing list or a block on
   * either side answers `not_found`, so neither leaks that the list exists.
   * Visible gifts keep their incoming order. A gift whose `ownerId` differs from
   * the list owner is dropped — the caller mapped rows from the wrong list.
   */
  resolve<T extends VisibilityGift>(
    viewer: VisibilityViewer,
    relations: ViewerRelations,
    list: VisibilityList | null,
    gifts: readonly T[],
  ): VisibilityResult<T> {
    if (list === null) return { access: "not_found", gifts: [], role: null };

    const owner = viewer !== null && viewer.id === list.ownerId;
    if (!owner && relations.blocked) {
      return { access: "not_found", gifts: [], role: null };
    }

    const visible = gifts.filter(
      (gift) => gift.ownerId === list.ownerId && canSee(viewer, relations, gift),
    );
    return { access: "gifts", gifts: visible, role: owner ? "owner" : "viewer" };
  },

  /**
   * Visibility values this viewer may see at all, for a database `where` filter
   * so hidden rows are never read (AD-7 / NFR-3). Mirrors `canSee` for an
   * unarchived gift; the owner still needs every value.
   */
  allowedVisibilities(
    viewer: VisibilityViewer,
    relations: ViewerRelations,
    ownerId: string,
  ): GiftVisibility[] {
    if (viewer !== null && viewer.id === ownerId) {
      return ["PUBLIC", "FRIENDS", "SECRET"];
    }
    if (relations.blocked) return [];

    if (viewer === null) {
      return relations.viaListToken ? ["PUBLIC"] : [];
    }

    const allowed: GiftVisibility[] = [];
    if (
      relations.friend ||
      relations.subscriber ||
      relations.contactMatch ||
      relations.viaListToken
    ) {
      allowed.push("PUBLIC");
    }
    if (relations.friend) allowed.push("FRIENDS");
    return allowed;
  },
} as const;
