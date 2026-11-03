// AD-7 — the single gate for every wishlist / gift-card read.
// Rules only: no Prisma, no React/Next.js here (AD-1). Callers map their row to
// `VisibilityGift` and hand the caller identity over as `VisibilityViewer`.

/** Closed `Gift.visibility` set (AD-7). */
export type GiftVisibility = "PUBLIC" | "FRIENDS" | "SECRET";

/** The person asking for a list or a gift card; `null` is an anonymous visitor. */
export type VisibilityViewer = { readonly id: string } | null;

/** The minimum gift data the gate needs; keeps Prisma rows out of the domain. */
export type VisibilityGift = {
  readonly ownerId: string;
  readonly visibility: GiftVisibility;
};

/**
 * What the viewer may receive (AD-7 read matrix). Only the owner branch exists
 * yet: every other viewer stays hidden until the friend / contact / public-link
 * branches land, so an unfinished branch can never leak a gift.
 */
export type VisibilityDecision =
  | { readonly visible: true; readonly role: "owner" }
  | { readonly visible: false };

export const VisibilityPolicy = {
  /**
   * The owner sees every own gift, including `SECRET` and archived ones; no
   * visibility value can hide a gift from its owner (AD-7, Story 3.2).
   */
  resolve(viewer: VisibilityViewer, gift: VisibilityGift): VisibilityDecision {
    if (viewer !== null && viewer.id === gift.ownerId) {
      return { visible: true, role: "owner" };
    }
    return { visible: false };
  },
} as const;
