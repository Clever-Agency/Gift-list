import "server-only";

import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { createTranslator } from "next-intl";
import { type GiftCard, type SupportedLocale } from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { readPublicWishlist } from "@/actions/public-wishlist";
import { canOpenPublicWishlist } from "@/actions/wishlist-read";
import { auth } from "@/lib/auth";
import { wishlistPathForToken } from "@/lib/public-token";
import { requestLocale } from "@/lib/request-locale";

/** The two public owner fields a link read may name (Story 3.3.1). */
export type LinkOwner = { displayName: string; nick: string };

/**
 * What the page may render, after the one gate has run. `not_found` covers an
 * unknown token, a malformed segment and a block: the page maps it to the real
 * HTTP 404 (`notFound()`), and the HTML and the metadata are the same for all
 * three.
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
 * - An authenticated visitor passes the same list access check before redirecting
 *   to `/wishlist/{token}`. The SPA fetches its own wish cards.
 * - Without a session the page reads through the same `readWishlist` gate as
 *   `api/v1`, anonymously, so only `PUBLIC` wishes reach the HTML.
 */
export async function loadLinkPage(token: string, giftId?: string): Promise<LinkPage> {
  const requestHeaders = await headers();
  const locale = requestLocale(requestHeaders.get("accept-language"));

  const to = wishlistPathForToken(token);
  // PostgreSQL text cannot contain a zero byte, including one decoded from a URL.
  if (to === null || giftId?.includes("\0")) {
    return { locale, view: { kind: "not_found" } };
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session && giftId === undefined) {
    const allowed = await canOpenPublicWishlist(token, { id: session.user.id });
    return { locale, view: allowed ? { kind: "redirect", to } : { kind: "not_found" } };
  }

  const data = await readPublicWishlist(
    token,
    session ? { id: session.user.id } : null,
    locale,
    giftId,
  );
  // A found list always names its owner for a link read; without it the answer
  // is treated as the same closed gate rather than rendering an unnamed list.
  if (data === null || !data.owner) return { locale, view: { kind: "not_found" } };
  if (giftId !== undefined && data.gifts.length === 0) {
    return { locale, view: { kind: "not_found" } };
  }
  if (session) return { locale, view: { kind: "redirect", to } };

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
 *
 * A 404 is answered from Next's not-found recovery document, and Next builds that
 * document's `<head>` from the segment `not-found.tsx`, not from this page
 * (`app-render`: `errorType: 'not-found'`). The boundary calls this builder with
 * `{ kind: "not_found" }`, so both the found page and the 404 keep the same
 * closed `Список не найден — {brand}` title; Next injects `noindex` itself.
 */
export function buildLinkMetadata(page: LinkPage, brand: string): Metadata {
  const messages = getWebMessages(page.locale);
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
