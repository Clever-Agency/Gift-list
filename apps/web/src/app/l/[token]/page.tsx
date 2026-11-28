import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBrandName } from "@/lib/env";
import { publicListPathForToken, wishlistPathForToken } from "@/lib/public-token";
import { buildLinkMetadata, getLinkPage } from "./link-page";
import { PublicWishlistView } from "./public-wishlist-view";

/**
 * Story 3.3 / AD-26: the first view of a public wishlist link, rendered by the
 * server for anonymous visitors and for messenger previews. A real session never
 * sees the public preview: an available list is handed to the SPA route
 * `/wishlist/{token}`, built from the validated segment only. A forged or
 * expired cookie is treated as anonymous.
 *
 * An unknown or malformed token and a `Block` render the segment `not-found.tsx`
 * through `notFound()`: a real HTTP 404 before streaming starts, one page for
 * every hidden cause (CLE-103).
 */
export async function generateMetadata({
  params,
}: PageProps<"/l/[token]">): Promise<Metadata> {
  const { token } = await params;
  const page = await getLinkPage(token);
  return buildLinkMetadata(page, getBrandName());
}

export default async function PublicWishlistPage({ params }: PageProps<"/l/[token]">) {
  const { token } = await params;
  const page = await getLinkPage(token);
  if (page.view.kind === "redirect") redirect(page.view.to);
  if (page.view.kind === "not_found") notFound();

  return (
    <PublicWishlistView
      view={page.view}
      locale={page.locale}
      listPath={publicListPathForToken(token)}
      wishlistPath={wishlistPathForToken(token)}
    />
  );
}

PublicWishlistPage.displayName = "PublicWishlistPage";
