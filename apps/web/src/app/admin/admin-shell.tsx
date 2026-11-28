"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE } from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { Heart, NavItem, Screen, Sidebar, Star, XStack, YStack } from "@gift-list/ui";
import styles from "./admin.module.css";

const messages = getWebMessages(DEFAULT_LOCALE);
const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: "web.admin" });

export type AdminShellProps = {
  /** The product name at the top of the menu (`BRAND_NAME`, AD-24). */
  brand: string;
  children: ReactNode;
};

/**
 * Story 10.1 / `DESIGN.md` → `/admin`: the editor's shell. From 1024 px the
 * side menu stands on the left («Подборки», «Теги»); narrower the page becomes
 * one column with the same two links above the content, and the table keeps its
 * own horizontal scroll. The skip link is the first stop of the Tab order and
 * the one `main` landmark receives the focus.
 *
 * The Expo app never imports this module: `/admin` is a Next page only (AD-22).
 */
export function AdminShell({ brand, children }: AdminShellProps) {
  const pathname = usePathname();
  const onTags = pathname.startsWith("/admin/tags");

  const links = (
    <>
      <NavItem
        variant="side"
        label={t("nav.collections")}
        icon={<Heart size={20} />}
        href="/admin"
        selected={!onTags}
      />
      <NavItem
        variant="side"
        label={t("nav.tags")}
        icon={<Star size={20} />}
        href="/admin/tags"
        selected={onTags}
      />
    </>
  );

  return (
    <Screen minHeight="100vh">
      <a className={styles.skipLink} href="#admin-main">
        {messages.web.skipToContent}
      </a>
      <XStack flex={1} minHeight={0} alignItems="stretch">
        <div className={styles.sidebar}>
          <Sidebar brand={brand} label={t("nav.label")}>
            {links}
          </Sidebar>
        </div>
        <YStack flex={1} minWidth={0}>
          <div className={styles.topNav}>
            <XStack
              gap="$1"
              paddingHorizontal="$3"
              paddingVertical="$2"
              backgroundColor="$surface"
              borderBottomWidth={1}
              borderColor="$border"
            >
              {links}
            </XStack>
          </div>
          <main id="admin-main" className={styles.main} tabIndex={-1}>
            {children}
          </main>
        </YStack>
      </XStack>
    </Screen>
  );
}

AdminShell.displayName = "AdminShell";
