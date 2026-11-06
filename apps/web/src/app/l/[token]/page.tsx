import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBrandName } from "@/lib/env";
import { wishlistPathForToken } from "@/lib/public-token";
import { buildLinkMetadata, getLinkPage } from "./link-page";
import { PublicWishlistView } from "./public-wishlist-view";

/**
 * Story 3.3 / AD-26: the first view of a public wishlist link, rendered by the
 * server for anonymous visitors and for messenger previews. A real session never
 * sees this page: it is handed to the SPA route `/wishlist/{token}`, built from
 * the validated segment only. A forged or expired cookie is no session, so the
 * anonymous page stays instead of an open redirect.
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

  return (
    <PublicWishlistView
      view={page.view}
      locale={page.locale}
      wishlistPath={wishlistPathForToken(token)}
    />
  );
}

PublicWishlistPage.displayName = "PublicWishlistPage";
