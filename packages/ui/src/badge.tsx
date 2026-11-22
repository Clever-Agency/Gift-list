import { XStack } from "@tamagui/stacks";
import { Text } from "./text";

export type BadgeProps = {
  /** The number of items waiting, e.g. incoming friend requests. */
  count: number;
  testID?: string;
};

/**
 * `DESIGN.md` → Badge (`components.badge-count`): the count pill on a tab or a
 * sidebar item — `primary` on `primary-foreground`, `rounded.sm`, `caption` 600.
 * Up to two digits are shown, more becomes «99+». A count of 0 (and a negative
 * one) draws nothing.
 *
 * The badge is decorative: `aria-hidden` keeps the number out of the tab order,
 * and the item that owns it carries the number in its own accessible name
 * («Друзья, 2 запроса», `EXPERIENCE.md` → Доступность → Навигация).
 */
export function Badge({ count, testID }: BadgeProps) {
  if (count <= 0) return null;

  return (
    <XStack
      testID={testID}
      aria-hidden
      minWidth={20}
      height={20}
      paddingHorizontal="$1"
      alignItems="center"
      justifyContent="center"
      borderRadius="$sm"
      backgroundColor="$primary"
      flexShrink={0}
    >
      <Text kind="caption" tone="inverse" fontWeight="600">
        {count > 99 ? "99+" : count}
      </Text>
    </XStack>
  );
}

Badge.displayName = "Badge";
