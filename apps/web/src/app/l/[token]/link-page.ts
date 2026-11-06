import "server-only";

import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { createTranslator } from "next-intl";
import { getMessages, type GiftCard, type SupportedLocale } from "@gift-list/contracts";
import { readPublicWishlist } from "@/actions/public-wishlist";
import { auth } from "@/lib/auth";
import { wishlistPathForToken } from "@/lib/public-token";
import { requestLocale } from "@/lib/request-locale";

/** The two public owner fields a link read may name (Story 3.3.1). */
export type LinkOwner = { displayName: string; nick: string };

/**
 * What the page may render, after the one gate has run. `not_found` covers an
 * unknown token, a malformed segment and a block: the HTML and the metadata are
 * the same for all three.
 */
export type LinkView =
  | { kind: "redirect"; to: string }
  | { kind: "not_found" }
  | { kind: "gifts"; owner: LinkOwner; gifts: GiftCard[] };

export type LinkPage = { locale: SupportedLocale; view: LinkView };

/**
 * Story 3.3 / AD-26: everything the page and its metadata need, loaded once.
 *
 * - A malformed token is the closed `not_found` before the session or database.
 * - A real session redirects only to the one-segment `/wishlist/{token}` built
 *   from the validated segment; the request pathname is never used as a target.
 * - Without a session the page reads through the same `readWishlist` gate as
 *   `api/v1`, anonymously, so only `PUBLIC` wishes reach the HTML.
 */
export async function loadLinkPage(token: string): Promise<LinkPage> {
  const requestHeaders = await headers();
  const locale = requestLocale(requestHeaders.get("accept-language"));

  const to = wishlistPathForToken(token);
  if (to === null) return { locale, view: { kind: "not_found" } };

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session) return { locale, view: { kind: "redirect", to } };

  const data = await readPublicWishlist(token, null, locale);
  // A found list always names its owner for a link read; without it the answer
  // is treated as the same closed gate rather than rendering an unnamed list.
  if (data.access === "not_found" || !data.owner) return { locale, view: { kind: "not_found" } };

  return {
    locale,
    view: { kind: "gifts", owner: data.owner, gifts: data.gifts },
  };
}

/**
 * One load per request: `generateMetadata` and the page share the same filtered
 * answer, so metadata never asks the database for a different set of wishes.
 */
export const getLinkPage = cache(loadLinkPage);

/**
 * Story 3.3: preview metadata names only the owner and the product. Wish titles,
 * prices, descriptions, photos and hidden counts are never consulted, so a
 * `not_found` metadata is indistinguishable for unknown, malformed and blocked
 * tokens.
 */
export function buildLinkMetadata(page: LinkPage, brand: string): Metadata {
  const messages = getMessages(page.locale);
  const t = createTranslator({ locale: page.locale, messages, namespace: "web.wishlist" });
  const web = createTranslator({ locale: page.locale, messages, namespace: "web" });
  const description = web("description");

  if (page.view.kind !== "gifts") {
    return {
      title: t("notFoundTitle", { brand }),
      description,
    };
  }

  const title = t("pageTitle", { name: page.view.owner.displayName, brand });
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}
