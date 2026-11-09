import { XStack } from "@tamagui/stacks";
import { WishCardSkeleton } from "./skeleton";

export type LoadingCardsProps = {
  /** The live-region name, e.g. «Загружаем вишлист». */
  label: string;
  /** A stable hook for tests; every loading state of the app has one. */
  testID?: string;
  /** The width of each skeleton; the caller owns the page grid. */
  width?: number | string;
  /** How many skeleton cards the loading state shows. */
  count?: number;
};

/**
 * The one card-skeleton loading state of the app: a named busy region instead of
 * anonymous grey boxes for assistive tech. It is rendered inside the page's own
 * `PageScroll`/`PageContainer`, so it never introduces another scroller.
 */
export function LoadingCards({ label, testID = "loading-cards", width, count = 3 }: LoadingCardsProps) {
  const cards = Array.from({ length: count }, function cardKey(_, index) {
    return index;
  });

  return (
    <XStack
      testID={testID}
      role="status"
      flexWrap="wrap"
      gap="$grid-gap"
      accessible
      aria-busy
      aria-label={label}
    >
      {cards.map(function renderSkeleton(key) {
        return <WishCardSkeleton key={key} testID="wish-card-skeleton" width={width} />;
      })}
    </XStack>
  );
}

LoadingCards.displayName = "LoadingCards";
