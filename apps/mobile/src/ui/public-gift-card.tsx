import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { TagChipList, WishCard as UiWishCard } from "@gift-list/ui";
import { useLocale, useTranslations } from "use-intl";
import { StatusPill } from "@/ui/status-pill";

/**
 * Story 3.3 / DESIGN → `/l/{token}`: the link visitor sees the same
 * `packages/ui` card as the owner, but without the visibility chip and without
 * the hidden-count affordance. The card is plain list content — there is no
 * public gift detail route — so it has no press zone and no visibility value in
 * its accessible name.
 *
 * The server has already applied `VisibilityPolicy`: whatever arrives in
 * `gift` is allowed for this viewer. This component deliberately does not
 * inspect `gift.visibility`.
 */
export function PublicGiftCard({
  gift,
  width,
}: {
  gift: GiftCardData;
  width: number;
}) {
  const t = useTranslations("app.myWishlist");
  const tGift = useTranslations("app.gift");
  const locale = useLocale();
  const price =
    gift.priceAmount !== null && gift.priceCurrency !== null
      ? formatPrice(gift.priceAmount, gift.priceCurrency, locale)
      : null;
  const reservation = gift.reservedBy
    ? t("reservedBy", { name: gift.reservedBy.displayName })
    : null;
  const tagLabels = gift.tags.map(function labelOfTag(tag) {
    return tag.label;
  });

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
      closed={gift.status === "CLOSED"}
      price={price}
      status={<StatusPill status={gift.status} />}
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
      reservation={reservation}
      width={width}
    />
  );
}

PublicGiftCard.displayName = "PublicGiftCard";
