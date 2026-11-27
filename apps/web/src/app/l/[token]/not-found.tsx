import type { Metadata } from "next";
import { headers } from "next/headers";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { PublicNotFound } from "@/components/public-not-found";
import { getBrandName } from "@/lib/env";
import { requestLocale } from "@/lib/request-locale";
import { buildLinkMetadata } from "./link-page";

/**
 * The metadata of the 404 document itself (followup CLE-103). A real HTTP 404 is
 * answered from Next's not-found recovery document, and Next builds that
 * document's `<head>` from *this* boundary — not from the page's
 * `generateMetadata` (`errorType: 'not-found'` in `app-render`). Without this
 * export the head fell back to the root layout, so crawlers and link previews got
 * `WishMoon` and the product description; the title «Список не найден — WishMoon»
 * only appeared after hydration.
 *
 * The builder is the page's own, so the 404 keeps the closed answer: unknown,
 * malformed and blocked tokens stay indistinguishable, and no owner or wish
 * field is consulted. `noindex` is injected by Next for every 404.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = requestLocale((await headers()).get("accept-language"));

  return buildLinkMetadata({ locale, view: { kind: "not_found" } }, getBrandName());
}

/**
 * The page-level 404 of `/l/[token]` (CLE-103): an unknown or malformed token, a
 * hidden list and a `Block` all land here through `notFound()`. The sentence and
 * the footer are the shared ones, so the 404 looks like the rest of the public
 * shell (AD-12 ред. 2026-11-17).
 *
 * Next 16 answers a real 404 with its not-found recovery document: this component
 * goes into the RSC payload and is painted after hydration, so the body of the
 * first HTML stays empty. `generateMetadata` above is the only part of the 404
 * that reaches the server HTML; the limitation and its options are recorded in
 * the CLE-103 followup report.
 */
export default async function WishlistNotFound() {
  const locale = requestLocale((await headers()).get("accept-language"));

  return <PublicNotFound locale={locale} message={getWebMessages(locale).web.wishlist.notFound} />;
}

WishlistNotFound.displayName = "WishlistNotFound";
