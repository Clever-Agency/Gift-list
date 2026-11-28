import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE } from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { getBrandName } from "@/lib/env";
import { requireAdmin } from "@/lib/admin";
import { listEditorialCollectionsForAdmin } from "@/lib/editorial-store";
import { CollectionsView } from "./collections-view";

const messages = getWebMessages(DEFAULT_LOCALE);
const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin.collections" });

export function generateMetadata(): Metadata {
  return {
    title: t("pageTitle", { brand: getBrandName() }),
    robots: { index: false, follow: false },
  };
}

/**
 * Story 10.1: the collections screen of `/admin`. The gate runs once more here
 * (the layout has its own) and every mutation checks the role again on the
 * server. The table is rendered by a client component for the dialogs, but its
 * first HTML already carries the rows.
 */
export default async function AdminCollectionsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) notFound();

  const collections = await listEditorialCollectionsForAdmin();

  return <CollectionsView collections={collections} />;
}

AdminCollectionsPage.displayName = "AdminCollectionsPage";
