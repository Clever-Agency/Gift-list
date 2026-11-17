"use client";

import { Button, StatusPill, Text, YStack } from "@gift-list/ui";

/**
 * The dev-only SSR smoke check (Story 1.9, narrowed in Story 1.10).
 *
 * It is not a component catalog: `Storybook` shows components and their states.
 * What only Next can prove stays here — that Tamagui renders on the server, that
 * its CSS reaches the first HTML with the theme's custom properties, and that the
 * provider wires the components in a Server/Client boundary. One control and one
 * pill are enough for that; examples must not duplicate stories.
 */
export function UiCheck() {
  return (
    <YStack gap="$3" paddingVertical="$5" paddingHorizontal="$4" maxWidth="$max-form">
      <Text kind="heading">SSR smoke: Tamagui в Next</Text>
      <Text tone="muted">
        Если эта страница отрисована, провайдер и CSS темы доехали до первого HTML.
      </Text>
      <YStack gap="$3" alignItems="flex-start">
        <Button label="Кнопка проверки" onPress={handleNoop} />
        <StatusPill status="open" label="Открыт" />
      </YStack>
    </YStack>
  );
}

UiCheck.displayName = "UiCheck";

function handleNoop() {}
