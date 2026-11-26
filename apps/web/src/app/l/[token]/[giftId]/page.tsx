import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBrandName } from "@/lib/env";
import { PublicWishView } from "./public-wish-view";
import { buildWishMetadata, getWishPage } from "./wish-page";

/**
 * D-63 / AD-26: the anonymous page of one wish of a public link. It renders on
 * the server for link visitors and messenger previews, through the same
 * `loadLinkPage` gate as `/l/[token]`, narrowed to the one requested card.
 *
 * A real session never sees this page: it is handed to the app route
 * `/gifts/{giftId}` with the list token, so the wish page opens with the same
 * access the click would have had. A forged or expired cookie is no session,
 * so the anonymous page stays instead of an open redirect.
 *
 * An unknown token, a block, a foreign or closed `giftId` and a malformed
 * segment all render the segment `not-found.tsx` through `notFound()`: a real
 * HTTP 404 before streaming starts, one page for every hidden cause (CLE-103).
 */
export async function generateMetadata({
  params,
}: PageProps<"/l/[token]/[giftId]">): Promise<Metadata> {
  const { token, giftId } = await params;
  const page = await getWishPage(token, giftId);
  return buildWishMetadata(page, getBrandName());
}

export default async function PublicWishPage({
  params,
}: PageProps<"/l/[token]/[giftId]">) {
  const { token, giftId } = await params;
  const page = await getWishPage(token, giftId);
  if (page.view.kind === "redirect") redirect(page.view.to);
  if (page.view.kind === "not_found") notFound();

  return (
    <PublicWishView
      view={page.view}
      locale={page.locale}
      listPath={page.listPath}
      wishlistPath={page.wishlistPath}
    />
  );
}

PublicWishPage.displayName = "PublicWishPage";
