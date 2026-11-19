import { XStack, YStack } from "@tamagui/stacks";
import type { ReactNode } from "react";
import { Info } from "./icons";
import { Pressable } from "./pressable";
import { ScrollView } from "./scroll";
import { Text } from "./text";

export type PartnerStoreRailProps = {
  /** The heading of the rail, e.g. «Магазины-партнёры». */
  title: string;
  /** The ad marking chip, e.g. «Партнёры»; hidden when omitted. */
  label?: string;
  /** The accessible explanation of the marking. */
  labelInfo?: string;
  /** Opens the explanation of the marking; without it the chip is static text. */
  onLabelPress?: () => void;
  /** The «Все» link of the heading row. */
  allLabel?: string;
  onAllPress?: () => void;
  /** `PartnerStoreCard`s; the rail is the only horizontal slider of the design. */
  children: ReactNode;
  testID?: string;
};

/** The ad marking chip: «Партнёры» plus the info sign, quiet and never red. */
function RailLabel({
  label,
  labelInfo,
  onPress,
}: {
  label: string;
  labelInfo?: string;
  onPress?: () => void;
}) {
  const content = (
    <XStack
      height={22}
      paddingHorizontal="$2"
      gap="$1"
      alignItems="center"
      borderRadius="$sm"
      backgroundColor="$muted"
    >
      <Text kind="caption" fontWeight="600" tone="muted">
        {label}
      </Text>
      <Info size={12} />
    </XStack>
  );

  if (onPress === undefined) return content;

  return (
    <Pressable
      role="button"
      aria-label={labelInfo ?? label}
      onPress={onPress}
      alignItems="center"
      justifyContent="center"
    >
      {content}
    </Pressable>
  );
}

RailLabel.displayName = "RailLabel";

/**
 * The v8 horizontal rail of the search screen (`DESIGN.md` → Partner stores): a
 * heading row with the optional ad marking and the «Все» link, then a one-row slider
 * of `PartnerStoreCard`s. This is the only horizontal wish/store pattern of the design:
 * wishes themselves are always the vertical grid. Presentational and string-free —
 * the title, the marking, «Все» and every card come from the caller.
 */
export function PartnerStoreRail({
  title,
  label,
  labelInfo,
  onLabelPress,
  allLabel,
  onAllPress,
  children,
  testID,
}: PartnerStoreRailProps) {
  return (
    <YStack gap="$2" testID={testID}>
      <XStack alignItems="center" gap="$2" paddingHorizontal="$page-gutter">
        <Text kind="heading" flexShrink={1} numberOfLines={1}>
          {title}
        </Text>
        {label ? <RailLabel label={label} labelInfo={labelInfo} onPress={onLabelPress} /> : null}
        {allLabel && onAllPress ? (
          <Pressable
            role="button"
            aria-label={allLabel}
            onPress={onAllPress}
            marginLeft="auto"
            minHeight="$touch-target"
            minWidth="$touch-target"
            alignItems="center"
            justifyContent="center"
          >
            <Text kind="button" tone="primary">
              {allLabel}
            </Text>
          </Pressable>
        ) : null}
      </XStack>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack role="list" gap={14} paddingHorizontal="$page-gutter">
          {children}
        </XStack>
      </ScrollView>
    </YStack>
  );
}

PartnerStoreRail.displayName = "PartnerStoreRail";
