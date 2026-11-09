import { PageFooter, XStack } from "@gift-list/ui";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { AuthorLink } from "@/ui/author-link";

/**
 * The app's one footer: the agency tagline and the «Написать автору» link from the
 * old auth screens. A screen may hand over its own actions (the wishlist passes
 * «Выйти» and «Настройки»), so the old per-screen footer rows disappear.
 *
 * It belongs inside the page's single `PageScroll`; the page column's `flexGrow`
 * keeps it at the bottom of a short page and the whole footer scrolls with the
 * content on a long one.
 */
export function SiteFooter({ actions }: { actions?: ReactNode }) {
  const t = useTranslations("common");

  return (
    <PageFooter tagline={t("footerTagline")}>
      {actions ? (
        <XStack
          testID="page-footer-actions"
          width="100%"
          flexWrap="wrap"
          alignItems="center"
          justifyContent="center"
          gap="$4"
        >
          {actions}
        </XStack>
      ) : null}
      <AuthorLink />
    </PageFooter>
  );
}

SiteFooter.displayName = "SiteFooter";
