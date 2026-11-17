import { AUTHOR_MAILTO, getMessages, type SupportedLocale } from "@gift-list/contracts";
import { LinkText, PageFooter } from "@gift-list/ui";

export type PublicPageFooterProps = {
  locale: SupportedLocale;
};

/**
 * The one footer of the Next shell (`DESIGN.md` → Общий каркас `/l`, `/i`,
 * `/unsubscribe`): «Написать автору» on the public `AUTHOR_MAILTO` (AD-24, D-35)
 * and the agency tagline. It has no `use client` directive, so the markup and the
 * copy are part of the first server HTML on both pages.
 *
 * The footer is identical on every public page and in every state of the page
 * (content, empty, not found): the copy comes only from the `common` catalog, so
 * the pages do not keep their own variants of it.
 */
export function PublicPageFooter({ locale }: PublicPageFooterProps) {
  const messages = getMessages(locale);

  return (
    <PageFooter tagline={messages.common.footerTagline}>
      <a href={AUTHOR_MAILTO} style={{ textDecoration: "none" }}>
        <LinkText>{messages.common.writeToAuthor}</LinkText>
      </a>
    </PageFooter>
  );
}

PublicPageFooter.displayName = "PublicPageFooter";
