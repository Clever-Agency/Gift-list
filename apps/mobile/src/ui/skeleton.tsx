import { WishCardSkeleton as UiWishCardSkeleton } from "@gift-list/ui";

/** `DESIGN.md` → Мелкие элементы: skeleton blocks in `muted`, shaped like a card. */
export function WishCardSkeleton({ width }: { width: number }) {
  return <UiWishCardSkeleton testID="wish-card-skeleton" width={width} />;
}

WishCardSkeleton.displayName = "WishCardSkeleton";
