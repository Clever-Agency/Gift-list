import { PageFooter, XStack } from "@gift-list/ui";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { useSessionStatus } from "@/session/session-status";
import { SupportLink } from "@/ui/support-link";

/**
 * The app's one footer: the agency tagline and, on screens without a session,
 * the «Написать в техподдержку» link (D-53). A screen may hand over its own
 * actions (the wishlist passes «Выйти» and «Настройки»), so the old per-screen
 * footer rows disappear.
 *
 * D-53: the link belongs to guests and to screens whose session is not known —
 * and to nobody else; a signed-in person finds it in `/profile`, so the footer
 * of an `(app)` screen carries no second copy. The footer reads the session
 * status the app has loaded already; it sends no request of its own.
 *
 * It belongs inside the page's single `PageScroll`; the page column's `flexGrow`
 * keeps it at the bottom of a short page and the whole footer scrolls with the
 * content on a long one.
 */
export function SiteFooter({ actions }: { actions?: ReactNode }) {
  const t = useTranslations("common");
  const status = useSessionStatus();

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
      {status === "ready" ? null : <SupportLink />}
    </PageFooter>
  );
}

SiteFooter.displayName = "SiteFooter";
