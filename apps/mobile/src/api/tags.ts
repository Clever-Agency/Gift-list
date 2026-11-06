import {
  tagCatalogSchema,
  type TagCatalogItem,
} from "@gift-list/contracts";
import { apiRequest, type ClientResult } from "@/api/client";

export type TagCatalogResult =
  | { ok: true; tags: TagCatalogItem[] }
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * Story 2.5 / AD-22 / AD-27: the fixed tag catalogue for the gift form. The
 * endpoint is public, so no session check happens here; `apiRequest` sends the
 * device `Accept-Language`, which is exactly what the server uses to pick each
 * `label`. Labels are never translated on the client.
 *
 * The answer is re-checked with the shared contract: an unexpected body is
 * `invalid` (the screen still offers a retry), not a broken connection.
 */
export async function fetchTagCatalog(): Promise<TagCatalogResult> {
  const result = await apiRequest<unknown>("/api/v1/tags");
  if (!result.ok) return result;

  const parsed = tagCatalogSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, invalid: true };

  return { ok: true, tags: parsed.data.tags };
}
