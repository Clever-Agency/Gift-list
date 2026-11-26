import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import type { ReactNode, Ref } from "react";
import {
  TagChipList,
  WishCard as UiWishCard,
  type FocusTarget,
} from "@gift-list/ui";
import { useLocale, useTranslations } from "use-intl";
import { StatusPill } from "@/ui/status-pill";

/** The comma-separated card name of `DESIGN.md` → Доступность, without empty parts. */
function joinCardName(parts: readonly (string | null)[]): string {
  return parts
    .filter(function hasText(part): part is string {
      return part !== null && part.trim() !== "";
    })
    .join(", ");
}

/**
 * Gift card from AD-12 (`DESIGN.md` → WishCard). The shape comes from
 * `@gift-list/contracts`, so the owner card only carries what the server allowed.
 *
 * D-49 (CLE-124): the owner never sees a reservation. The server already sends an
 * owner card as `OPEN` with `reservedBy` and `ownerAction` empty, and this card
 * repeats the rule on its side: even a stale cached `RESERVED` card reads as
 * open, with no «Забронирован» pill, no holder name and no phase label.
 *
 * The card stays presentational and reusable in non-owner lists: only a passed
 * `onPress` makes the whole card a button (the full `DESIGN.md` → Доступность
 * phrase), and without it the card is plain list content. The list item wrapper
 * is always the outer element, so the list semantics of the grid survive the
 * pressable inside it.
 *
 * The detail button covers the whole card (CLE-65, CLE-84): nothing is nested, so
 * one press opens the edit route.
 *
 * D-54 (CLE-129): the card has no visibility chip and no «who sees» control at
 * all — visibility changes only in the wish form. The owner card keeps the status
 * pill and the ⋯ menu; a legacy `RESERVED` card still reads as open (D-49).
 *
 * NOTE FOR UX: the wish photo is not in the contract yet, so the v8 card shows the
 * placeholder. CLE-84: the press zone opens the detail dialog. The ⋮ menu is still
 * pending; «Изменить желание» lives in that dialog, not on the card.
 */
export function WishCard({
  gift,
  width,
  onPress,
  pressRef,
  menu,
  closed = false,
}: {
  gift: GiftCardData;
  width: number;
  onPress?: () => void;
  /** The card button, so the detail dialog can return focus to it. */
  pressRef?: Ref<FocusTarget>;
  /** Archive menu, drawn as a sibling of the card button (Story 2.6). */
  menu?: ReactNode;
  /** Archive cards read as closed even while the stored status stays OPEN. */
  closed?: boolean;
}) {
  const tGift = useTranslations("app.gift");
  const tStatus = useTranslations("app.gift.status");
  const locale = useLocale();
  const price =
    gift.priceAmount !== null && gift.priceCurrency !== null
      ? formatPrice(gift.priceAmount, gift.priceCurrency, locale)
      : null;
  // D-49: a reservation is never a fact for the owner. A stale card may still say
  // `RESERVED`; it is shown exactly like an open wish.
  const status = gift.status === "RESERVED" ? "OPEN" : gift.status;
  // Story 2.5.7: labels are the server's, already ordered by the mapper. The
  // visual row shows up to three chips; the accessible name keeps every tag so
  // a screen reader hears tags that «+N» hides.
  const tagLabels = gift.tags.map(function labelOfTag(tag) {
    return tag.label;
  });
  // `DESIGN.md` → Доступность: the pressable main zone reads as one phrase —
  // title, price, status and all tags. D-54: visibility is not part of the card,
  // so it is not in the phrase either. Empty parts are dropped, so no double
  // separators reach the screen reader.
  const pressLabel = joinCardName([
    gift.title,
    price,
    tStatus(status),
    tagLabels.length > 0 ? tagLabels.join(", ") : null,
  ]);

  function moreTagLabel(hiddenCount: number): string {
    return tGift("tagsMore", { count: hiddenCount });
  }

  function moreTagAccessibilityLabel(
    hiddenCount: number,
    hiddenLabels: readonly string[],
  ): string {
    return tGift("tagsMoreLabel", { count: hiddenCount, tags: hiddenLabels.join(", ") });
  }

  return (
    <UiWishCard
      title={gift.title}
      closed={closed || gift.status === "CLOSED"}
      price={price}
      status={<StatusPill status={status} />}
      tags={
        tagLabels.length > 0 ? (
          <TagChipList
            labels={tagLabels}
            testID="gift-tags"
            moreLabel={moreTagLabel}
            moreAccessibilityLabel={moreTagAccessibilityLabel}
          />
        ) : undefined
      }
      onPress={onPress}
      pressLabel={pressLabel}
      pressRef={pressRef as never}
      width={width}
      menu={menu}
    />
  );
}

WishCard.displayName = "WishCard";
