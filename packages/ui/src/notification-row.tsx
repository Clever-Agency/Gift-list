import type { ReactNode } from "react";
import { View } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import { Pressable } from "./pressable";
import { Text } from "./text";

export type NotificationRowProps = {
  message: string;
  time: string;
  subtitle?: string;
  unread: boolean;
  newLabel: string;
  icon: ReactNode;
  actions?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
};

export function NotificationRow({
  message, time, subtitle, unread, newLabel, icon, actions, selected, onPress,
}: NotificationRowProps) {
  const copy = (
    <>
      <Text kind={unread ? "body-strong" : "body"} numberOfLines={3}>{message}</Text>
      {subtitle ? <Text kind="caption" tone="muted">{subtitle}</Text> : null}
      <Text kind="caption" tone="muted">{time}</Text>
    </>
  );
  const label = [unread ? newLabel : null, message, subtitle, time].filter(Boolean).join(". ");
  return (
    <XStack role="listitem" alignItems="flex-start" gap="$3" paddingVertical="$2"
      borderBottomWidth={1} borderColor="$border" backgroundColor={selected ? "$muted" : "transparent"}
    >
      <View width={8} height={8} marginTop="$3" borderRadius="$full" aria-hidden
        backgroundColor={unread ? "$primary" : "transparent"}
      />
      <View aria-hidden marginTop="$2">{icon}</View>
      <YStack flex={1} minWidth={0} gap="$2">
        {onPress ? (
          <Pressable role="button" aria-label={label} onPress={onPress} minHeight="$touch-target" alignItems="flex-start">
            <YStack gap="$1">{copy}</YStack>
          </Pressable>
        ) : (
          <YStack role="group" aria-label={label} gap="$1">{copy}</YStack>
        )}
        {actions ? <XStack flexWrap="wrap" gap="$2">{actions}</XStack> : null}
      </YStack>
    </XStack>
  );
}

NotificationRow.displayName = "NotificationRow";
