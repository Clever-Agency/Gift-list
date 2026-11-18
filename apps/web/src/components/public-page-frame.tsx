"use client";

import type { ReactNode } from "react";
import { getMessages, type SupportedLocale } from "@gift-list/contracts";
import { Screen } from "@gift-list/ui";
import { PublicPageFooter } from "./public-page-footer";
import styles from "./public-page-frame.module.css";

/**
 * The id of the one `main` of the public shell. The skip link points here and the
 * landmark carries it, so the target and the link can never drift apart.
 */
export const PUBLIC_MAIN_ID = "main-content";

export type PublicPageFrameProps = {
  locale: SupportedLocale;
  /** The `next-header` of `/i`, when the page has one (`DESIGN.md` → Next-страницы). */
  header?: ReactNode;
  /** The content of the `main` landmark. */
  children: ReactNode;
};

/**
 * The one frame of the Next pages of the public shell — `/l`, `/i` and their
 * 404s (`DESIGN.md` → Общий каркас `/l`, `/i`, `/unsubscribe`, EXPERIENCE.md →
 * Accessibility Floor). It keeps the shell in one place: the skip link
 * «Перейти к содержимому» is the first element and therefore the first stop of
 * the Tab order, the header (when the page has one) follows, then the single
 * `main` landmark and the shared footer.
 *
 * The skip link is a plain `<a href>` in the markup of the first server HTML, and
 * `main` takes `tabIndex={-1}`, so the browser really moves the focus to the
 * content instead of only scrolling to it. A real `<main>` element replaces the
 * `role="main"` box the views used to draw.
 */
export function PublicPageFrame({ locale, header, children }: PublicPageFrameProps) {
  const messages = getMessages(locale);

  return (
    <Screen>
      <a className={styles.skipLink} href={`#${PUBLIC_MAIN_ID}`}>
        {messages.web.skipToContent}
      </a>
      {header}
      <main id={PUBLIC_MAIN_ID} className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <PublicPageFooter locale={locale} />
    </Screen>
  );
}

PublicPageFrame.displayName = "PublicPageFrame";
