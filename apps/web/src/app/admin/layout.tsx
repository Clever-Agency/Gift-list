import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createTranslator } from "next-intl";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE } from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { getBrandName } from "@/lib/env";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "./admin-shell";

const messages = getWebMessages(DEFAULT_LOCALE);
const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin" });

export function generateMetadata(): Metadata {
  return {
    title: t("title", { brand: getBrandName() }),
    robots: { index: false, follow: false },
  };
}

/**
 * Story 10.1 / AD-22: the one gate of `/admin`. An anonymous visitor, a USER
 * and an account without a role all get Next's own `notFound()` — no sign-in
 * form, no redirect, the same document as any missing page. Every server action
 * checks the role again on its own; this gate only protects the screen.
 *
 * The shell is a client component (the side menu marks the current route), the
 * session role is read on the server. `/admin` is absent from the Expo app on
 * every platform.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const gate = await requireAdmin();
  if (!gate.ok) notFound();

  return <AdminShell brand={getBrandName()}>{children}</AdminShell>;
}

AdminLayout.displayName = "AdminLayout";
