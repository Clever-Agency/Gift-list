import type { Metadata } from "next";
import { headers } from "next/headers";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { PublicNotFound } from "@/components/public-not-found";
import { getBrandName } from "@/lib/env";
import { requestLocale } from "@/lib/request-locale";
import { buildWishMetadata } from "./wish-page";

/**
 * The metadata of the 404 document of `/l/[token]/[giftId]`. Next builds the
 * `<head>` of a not-found answer from this boundary, not from the page, so the
 * closed title «Желание не найдено — {brand}» has to be produced here too. One
 * title serves an unknown token, a block, a foreign id and a closed wish: the
 * 404 never says why.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = requestLocale((await headers()).get("accept-language"));

  return buildWishMetadata({ locale, view: { kind: "not_found" } }, getBrandName());
}

/**
 * The page-level 404 of one wish (D-63): an unknown or malformed token, a
 * block, a foreign `giftId`, and a wish the link may not open all land here.
 * The sentence and the footer are the shared ones of the public shell, so the
 * 404 looks like `/l` and `/i`.
 *
 * As on `/l/[token]`, Next 16 answers a real 404 with its recovery document:
 * this component is painted after hydration, and the `generateMetadata` above
 * is the part of the 404 that reaches the server HTML.
 */
export default async function WishNotFound() {
  const locale = requestLocale((await headers()).get("accept-language"));

  return <PublicNotFound locale={locale} message={getWebMessages(locale).web.wishlist.wishNotFound} />;
}

WishNotFound.displayName = "WishNotFound";
