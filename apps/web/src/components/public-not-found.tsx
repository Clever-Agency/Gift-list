"use client";

import type { SupportedLocale } from "@gift-list/contracts";
import { Column, Heading, Screen, YStack } from "@gift-list/ui";
import { PublicPageFooter } from "@/components/public-page-footer";

export type PublicNotFoundProps = {
  locale: SupportedLocale;
  /** The catalog sentence of the segment (`web.wishlist.notFound` / `web.invite.notFound`). */
  message: string;
};

/**
 * The shared page-level 404 of the public shell (AD-12 ред. 2026-11-17, CLE-103).
 * `/l/[token]` and `/i/[token]` call `notFound()`, so Next answers a real HTTP 404
 * and renders this frame: the same `h1` sentence from i18n and the same full
 * `PublicPageFooter` as the found page, no owner, no wishes and no actions.
 *
 * The document title stays the segment's `notFoundTitle`, produced by the
 * segment `not-found.tsx` `generateMetadata` because Next builds the 404
 * document's `<head>` from that boundary; Next injects `noindex` into every 404
 * itself. The frame itself is painted after hydration: Next 16 keeps the body of
 * the first 404 HTML empty.
 */
export function PublicNotFound({ locale, message }: PublicNotFoundProps) {
  return (
    <Screen>
      <YStack flexGrow={1} role="main">
        <Column size="wide" flexGrow={1} paddingVertical="$section-gap">
          <Heading level={1} kind="display-sm" textAlign="center">
            {message}
          </Heading>
        </Column>
      </YStack>
      <PublicPageFooter locale={locale} />
    </Screen>
  );
}

PublicNotFound.displayName = "PublicNotFound";
