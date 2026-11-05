import { YStack } from "@tamagui/stacks";
import type { ReactNode } from "react";
import { Heading, Text } from "./text";

export type EmptyStateProps = {
  title: string;
  body: string;
  /** At most one primary CTA. */
  action?: ReactNode;
};

/** `DESIGN.md` → EmptyState: display title, one body line, at most one primary CTA. */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <YStack
      width="100%"
      maxWidth="$max-form"
      alignSelf="center"
      alignItems="center"
      paddingVertical="$section-gap"
      gap="$grid-gap"
    >
      <Heading level={2} kind="display-sm" textAlign="center">
        {title}
      </Heading>
      <Text tone="muted" textAlign="center">
        {body}
      </Text>
      {action ? <YStack width="100%">{action}</YStack> : null}
    </YStack>
  );
}

EmptyState.displayName = "EmptyState";
