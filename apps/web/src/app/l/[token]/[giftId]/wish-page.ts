import "server-only";

import { cache } from "react";
import type { Metadata } from "next";
import { createTranslator } from "next-intl";
import {
  type GiftCard,
  type SupportedLocale,
} from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { publicListPathForToken, wishlistPathForToken } from "@/lib/public-token";
import { loadLinkPage, type LinkOwner } from "../link-page";

/**
 * What the wish page may render, after the one gate has run. `not_found` covers
 * an unknown token, a malformed segment, a block, and every wish the gate did
 * not return to the link (FRIENDS, SECRET, archived, another list's id): all of
 * them look the same, so the page never explains the cause (AD-7, D-63).
 */
export type WishView =
  | { kind: "redirect"; to: string }
  | { kind: "not_found" }
  | { kind: "wish"; owner: LinkOwner; gift: GiftCard };

/** The part of the page that the metadata builder needs. */
export type WishHeading = { locale: SupportedLocale; view: WishView };

export type WishPage = WishHeading & {
  /** `/l/{token}` of the validated segment: the way back to the list. */
  listPath: string | null;
  /** `/wishlist/{token}` of the validated segment: the app target of «Куплю сам». */
  wishlistPath: string | null;
};

/**
 * `/gifts/{id}` of the app: where a real session continues from the public
 * page. The list token rides along, because a signed-in visitor who is not a
 * friend still sees a PUBLIC wish only through the link (AD-7).
 */
function appWishPath(giftId: string, token: string): string {
  return `/gifts/${encodeURIComponent(giftId)}?listToken=${encodeURIComponent(token)}`;
}

/**
 * Story 3.3 / D-63 / AD-15 (14): one wish of a public link. The read is the
 * list read of `/l/[token]` itself — the same gate, the same card, the same
 * allowed fields — narrowed to the requested id within the token's list.
 * The check applies before a signed-in visitor is redirected to the app.
 */
export async function loadWishPage(token: string, giftId: string): Promise<WishPage> {
  const page = await loadLinkPage(token, giftId);
  const paths = {
    listPath: publicListPathForToken(token),
    wishlistPath: wishlistPathForToken(token),
  };

  if (page.view.kind === "not_found") {
    return { locale: page.locale, ...paths, view: { kind: "not_found" } };
  }
  if (page.view.kind === "redirect") {
    return {
      locale: page.locale,
      ...paths,
      view: { kind: "redirect", to: appWishPath(giftId, token) },
    };
  }

  const gift = page.view.gifts.find(function isRequested(card) {
    return card.id === giftId;
  });
  if (gift === undefined) {
    return { locale: page.locale, ...paths, view: { kind: "not_found" } };
  }

  return {
    locale: page.locale,
    ...paths,
    view: { kind: "wish", owner: page.view.owner, gift },
  };
}

/**
 * One load per request: `generateMetadata` and the page share the same filtered
 * answer, so the metadata cannot name a wish the body did not render.
 */
export const getWishPage = cache(loadWishPage);

/** A public page of one wish is not an indexable document, found or not. */
const NO_INDEX = { index: false, follow: false } as const;

/**
 * D-63: the document title is the wish title (`DESIGN.md` → Next-страницы,
 * «{Желание} — {BRAND}»), with `robots: noindex` — a wish is a private fact of
 * the owner, even when the link is public. The 404 keeps one closed title for
 * every hidden cause, and the wish title is never consulted there.
 *
 * No `openGraph` here on purpose: the link page shares only the owner and the
 * product, and a messenger preview must not quote the wish.
 */
export function buildWishMetadata(heading: WishHeading, brand: string): Metadata {
  const messages = getWebMessages(heading.locale);
  const t = createTranslator({ locale: heading.locale, messages, namespace: "web.wishlist" });
  const web = createTranslator({ locale: heading.locale, messages, namespace: "web" });
  const description = web("description");

  if (heading.view.kind !== "wish") {
    return {
      title: t("wishNotFoundTitle", { brand }),
      description,
      robots: NO_INDEX,
    };
  }

  return {
    title: t("wishPageTitle", { title: heading.view.gift.title, brand }),
    description,
    robots: NO_INDEX,
  };
}
