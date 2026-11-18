import { XStack, YStack } from "@tamagui/stacks";
import type { ReactNode } from "react";

export type FriendsTwoPaneProps = {
  /** The left pane: the segments, the search and the rows the screen already draws. */
  list: ReactNode;
  /** The right pane: the selected friend's header and wish grid. */
  detail?: ReactNode;
  /** Shown in the right pane when no friend is selected. */
  empty?: ReactNode;
  /** The width of the left pane; the right one takes the rest. */
  listWidth?: number | string;
  testID?: string;
};

/**
 * The desktop layout of the Friends screen, variant D (`blocks/07-friends.png`):
 * two panes side by side — the list on the left, the selected friend's wishlist on the
 * right. Purely presentational: the screen supplies both panes, so the layout adds no
 * data fetching, no selection state and no routes of its own. Used from the `wide`
 * breakpoint; a phone keeps the single-column list.
 */
export function FriendsTwoPane({
  list,
  detail,
  empty,
  listWidth = 320,
  testID,
}: FriendsTwoPaneProps) {
  return (
    <XStack gap="$column-gap" alignItems="flex-start" width="100%" testID={testID}>
      <YStack width={listWidth} flexShrink={0} testID={testID ? `${testID}-list` : undefined}>
        {list}
      </YStack>
      <YStack flex={1} minWidth={0} testID={testID ? `${testID}-detail` : undefined}>
        {detail ?? empty}
      </YStack>
    </XStack>
  );
}

FriendsTwoPane.displayName = "FriendsTwoPane";
