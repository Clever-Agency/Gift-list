import { getMyInviteLink } from "@/api/invite-link";
import { copyText } from "@/platform/clipboard";
import { inviteShareLink } from "@/invite/share-link";

/**
 * The outcome of «Скопировать ссылку-приглашение» (Story 4.7). `failed` covers a
 * missing origin or token, a refused read of the own link and a refused clipboard
 * write: the person sees one error toast, because the link is not in the
 * clipboard either way.
 */
export type CopyInviteLinkResult = "copied" | "failed";

/**
 * Reads the viewer's immutable token (`GET /api/v1/me/invite-link`), builds
 * `{origin}/i/{token}` and copies it. The token is read only on this press, never
 * while the screen loads, so a failed or refused copy never pretends success.
 */
export async function copyMyInviteLink(origin?: string): Promise<CopyInviteLinkResult> {
  try {
    const result = await getMyInviteLink();
    if (!result.ok) return "failed";
    const link = inviteShareLink(result.token, origin);
    if (link === null) return "failed";
    return (await copyText(link)) ? "copied" : "failed";
  } catch {
    // The adapters guard their own platform calls; this is a second line so a
    // rejected clipboard future still ends as an error toast, not a false success.
    return "failed";
  }
}
