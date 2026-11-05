import { copyText } from "@/platform/clipboard";
import { wishlistShareLink } from "@/wishlist/share-link";

/**
 * The outcome of the «Скопировать ссылку» press (Story 2.4). `failed` covers both
 * a missing origin or token and a refused clipboard write: the person sees one
 * error toast, because the link is not in the clipboard either way.
 */
export type CopyShareLinkResult = "copied" | "failed";

/**
 * Builds `{origin}/l/{publicToken}` and copies it (AD-6, Q-2). A `null` link is
 * never copied: the caller shows the error toast instead of a broken string.
 */
export async function copyWishlistShareLink(
  publicToken: string | null,
  origin?: string,
): Promise<CopyShareLinkResult> {
  const link = wishlistShareLink(publicToken ?? "", origin);
  if (link === null) return "failed";
  return (await copyText(link)) ? "copied" : "failed";
}
