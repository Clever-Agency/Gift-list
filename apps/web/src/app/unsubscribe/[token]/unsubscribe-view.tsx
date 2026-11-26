"use client";

import { getMessages, type Messages, type SupportedLocale } from "@gift-list/contracts";
import { Button, Column, Heading, Text, YStack } from "@gift-list/ui";
import { PublicPageFrame } from "@/components/public-page-frame";
import type { UnsubscribeView as UnsubscribeViewState } from "./unsubscribe-page";

export type UnsubscribeViewProps = {
  view: UnsubscribeViewState;
  locale: SupportedLocale;
  /** The validated path segment; the «Вернуть» form posts back through it. */
  token: string;
};

function messageFor(
  view: UnsubscribeViewState,
  copy: Messages["web"]["unsubscribe"],
): string {
  if (view.kind === "invalid") return copy.invalid;
  if (view.kind === "restored") return copy.restored;
  return view.type === "friendDates" ? copy.friendDatesDone : copy.ownListDone;
}

/**
 * CLE-137 / DESIGN.md → Next-страницы, `/unsubscribe/{token}`: the `next-panel`
 * of the public shell, with no «Войти» and no account data. The `h1` is the
 * sentence of the current state; the only action is «Вернуть», a real form POST
 * (a GET must stay safe: a link preview would otherwise re-enable a switch).
 *
 * After «Вернуть» the same page is rendered from the `restored` query, so the
 * fresh document starts with the `role="status"` heading — the reading order
 * moves to it without client JavaScript.
 */
export function UnsubscribeView({ view, locale, token }: UnsubscribeViewProps) {
  const copy = getMessages(locale).web.unsubscribe;
  const message = messageFor(view, copy);
  const restoreHref = `/unsubscribe/${encodeURIComponent(token)}/restore`;

  return (
    <PublicPageFrame locale={locale}>
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
          {view.kind === "restored" ? (
            <YStack role="status" tabIndex={-1} alignItems="center" gap="$grid-gap">
              <Heading level={1} kind="heading" textAlign="center">
                {message}
              </Heading>
            </YStack>
          ) : (
            <Heading level={1} kind="heading" textAlign="center">
              {message}
            </Heading>
          )}
          {view.kind === "done" ? (
            <>
              <Text kind="body" textAlign="center">
                {copy.explain}
              </Text>
              <form method="post" action={restoreHref}>
                <Button type="submit" variant="secondary" label={copy.restore} />
              </form>
            </>
          ) : null}
        </YStack>
      </Column>
    </PublicPageFrame>
  );
}

UnsubscribeView.displayName = "UnsubscribeView";
