import { XStack } from "@gift-list/ui";
import type { ReactNode } from "react";

export type CardGridListProps = {
  children: ReactNode;
  /**
   * Rows start at their own top edge (`align-items: flex-start`) instead of
   * stretching every cell: a grid of cards of different heights — the wishlist and
   * the reservation list — keeps each card the height of its own content.
   */
  alignStart?: boolean;
  testID?: string;
};

/**
 * `DESIGN.md` → Layout → columns: the one card grid of the app — `role="list"`, the
 * cards wrap by their own width (`useCardGrid` hands it over as `cardWidth`) with
 * `grid-gap` between them. Every wishlist and the «Мои брони» screen draw the same
 * element, so the columns, the gap and the list semantics cannot drift apart.
 */
export function CardGridList({ children, alignStart, testID }: CardGridListProps) {
  return (
    <XStack
      role="list"
      testID={testID}
      flexWrap="wrap"
      alignItems={alignStart ? "flex-start" : undefined}
      gap="$grid-gap"
    >
      {children}
    </XStack>
  );
}

CardGridList.displayName = "CardGridList";
