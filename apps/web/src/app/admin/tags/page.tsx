import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE } from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { getBrandName } from "@/lib/env";
import { requireAdmin } from "@/lib/admin";
import { listCustomTagQueue, listTagCatalogForAdmin } from "@/lib/custom-tag-store";
import { TagsView } from "./tags-view";

const messages = getWebMessages(DEFAULT_LOCALE);
const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin.tags" });

export function generateMetadata(): Metadata {
  return {
    title: t("pageTitle", { brand: getBrandName() }),
    robots: { index: false, follow: false },
  };
}

/**
 * Story 10.2: the tags moderation screen of `/admin`. The gate runs once more here
 * (the layout has its own) and every decision checks the role again on the server.
 * The queue carries no owner and no SECRET wish, and the catalog is read without
 * the authors of custom texts (AD-22).
 *
 * Both reads start together: the table works with either answer, and the approve
 * layer only needs the catalog when the moderator opens an existing tag.
 */
export default async function AdminTagsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) notFound();

  const [queue, tags] = await Promise.all([listCustomTagQueue(), listTagCatalogForAdmin()]);

  return <TagsView queue={queue} tags={tags} />;
}

AdminTagsPage.displayName = "AdminTagsPage";
