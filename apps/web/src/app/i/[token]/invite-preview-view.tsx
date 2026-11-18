"use client";

import { createTranslator } from "next-intl";
import { getMessages, type SupportedLocale } from "@gift-list/contracts";
import { Button, Column, Heading, Text, XStack, YStack } from "@gift-list/ui";
import { PublicPageFrame } from "@/components/public-page-frame";
import type { InviteView } from "./invite-page";

export type InvitePreviewData = Extract<InviteView, { kind: "invite" }>;

export type InvitePreviewViewProps = {
  view: InvitePreviewData;
  locale: SupportedLocale;
  /** The product name of the shell (`BRAND_NAME`, AD-24), read by the server page. */
  brand: string;
};

/**
 * The avatar of DESIGN.md → Мелкие элементы: a circle with the first letters of
 * the name (`avatar-lg`). Decorative: the `h1` carries the name.
 */
function initials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(function firstLetter(word) {
      return word.charAt(0).toUpperCase();
    })
    .join("");
}

/**
 * Story 4.7: the anonymous invite page, built from the same `packages/ui` shell
 * as `/l` (`DESIGN.md` → Общий каркас `/l`, `/i`, `/unsubscribe`). The inviter is
 * the one `h1`; the two page actions are real links into the app: registration
 * carries the token in `next`, login returns to the app invite screen, where the
 * friendship is confirmed (AD-21 — the page itself writes nothing).
 *
 * Only a live invite reaches this view: an unknown token, a malformed segment and
 * a `Block` are the real 404 of `not-found.tsx` (CLE-103).
 */
export function InvitePreviewView({ view, locale, brand }: InvitePreviewViewProps) {
  const messages = getMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "web.invite" });

  const signInHref = `/login?next=${view.to}`;

  const header = (
    <XStack
      width="100%"
      minHeight="$header"
      alignItems="center"
      backgroundColor="$background"
      borderBottomWidth={1}
      borderColor="$border"
    >
      <Column size="wide">
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <Text kind="display-sm">{brand}</Text>
          <Button variant="ghost" label={t("signIn")} href={signInHref} />
        </XStack>
      </Column>
    </XStack>
  );

  return (
    <PublicPageFrame locale={locale} header={header}>
      <Column size="wide" flexGrow={1} paddingVertical="$section-gap" alignItems="center">
        <YStack
          width="100%"
          maxWidth="$dialog-width"
          alignItems="center"
          gap="$grid-gap"
          backgroundColor="$surface"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$lg"
          padding="$section-gap"
        >
          <YStack
            width="$avatar-lg"
            height="$avatar-lg"
            alignItems="center"
            justifyContent="center"
            backgroundColor="$muted"
            borderRadius="$full"
            aria-hidden
          >
            <Text kind="heading" tone="muted">
              {initials(view.inviter.displayName)}
            </Text>
          </YStack>
          <Heading level={1} kind="display-sm" textAlign="center">
            {t("title", { name: view.inviter.displayName })}
          </Heading>
          <Text kind="body" textAlign="center">
            {t("body")}
          </Text>
          <YStack width="100%" gap="$2">
            <Button fullWidth label={t("accept")} href={`/register?next=${view.to}`} />
            <Button
              fullWidth
              variant="ghost"
              label={t("haveAccount")}
              href={`/login?next=${view.to}`}
            />
          </YStack>
        </YStack>
      </Column>
    </PublicPageFrame>
  );
}

InvitePreviewView.displayName = "InvitePreviewView";
