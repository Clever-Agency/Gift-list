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
 * A refused write and a platform exception are the same `failed`: the link did
 * not reach the clipboard, so the screen must never claim success.
 */
export async function copyWishlistShareLink(
  publicToken: string | null,
  origin?: string,
): Promise<CopyShareLinkResult> {
  try {
    const link = wishlistShareLink(publicToken ?? "", origin);
    if (link === null) return "failed";
    return (await copyText(link)) ? "copied" : "failed";
  } catch {
    // The adapters guard their own platform calls; this is a second line so a
    // rejected clipboard future still ends as an error toast, not a false success.
    return "failed";
  }
}
