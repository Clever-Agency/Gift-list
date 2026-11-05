import "server-only";

import {
  negotiateLocale,
  preferredFromAcceptLanguage,
  tagCatalogSchema,
  type ActionResult,
  type TagCatalog,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import {
  compareTagCatalogSlugs,
  toTagCatalogItem,
  type TagCatalogRow,
} from "@/domain/tag";

/** AD-12 has no internal-error code; `message` stays diagnostic and is not shown to users. */
function catalogUnavailableError(): ActionResult<TagCatalog> {
  return {
    ok: false,
    code: "NOT_FOUND",
    message: "Tag catalog is unavailable",
  };
}

/**
 * Story 2.5 / AD-22 / AD-27: the fixed tag catalog for the gift form.
 *
 * The endpoint carries no user data, so it is a public read: the answer depends
 * only on the request language, not on the session. The language comes from
 * `Accept-Language` through the same `negotiateLocale()` as registration, so an
 * unknown or missing header falls back to `DEFAULT_LOCALE` (`ru`). The label is
 * always taken from the stored `labels`, never from a caption in code; a row
 * without any usable label is left out rather than shown blank.
 *
 * Ordering is `slug` ascending in code units (see `compareTagCatalogSlugs`),
 * applied here so it does not depend on the database collation.
 *
 * A database or contract failure is reported through the standard envelope with
 * the closest closed code (`NOT_FOUND`). The limitation is recorded in the 2.5.4
 * report.
 */
export async function getTagCatalog(headers: Headers): Promise<ActionResult<TagCatalog>> {
  const locale = negotiateLocale(preferredFromAcceptLanguage(headers.get("accept-language")));

  try {
    const rows: TagCatalogRow[] = await prisma.tag.findMany({
      select: { id: true, slug: true, labels: true },
    });

    const tags = rows
      .map(function mapCatalogRow(row) {
        return toTagCatalogItem(row, locale);
      })
      .filter(function hasLabel(tag) {
        return tag.label !== "";
      })
      .sort(compareTagCatalogSlugs);

    return { ok: true, data: tagCatalogSchema.parse({ tags }) };
  } catch (error) {
    console.error("Tag catalog read failed", error);
    return catalogUnavailableError();
  }
}
