import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { Button, TagChipList, Text, WishCard as UiWishCard, YStack, restoreFocus, type FocusTarget } from "@gift-list/ui";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { StatusPill } from "@/ui/status-pill";
import { WishDetailDialog } from "@/ui/wish-detail-dialog";
import type { DetailLoadResult } from "@/ui/wish-detail-load";

/**
 * Story 3.3 / DESIGN → `/l/{token}`: the link visitor sees the same
 * `packages/ui` card as the owner, but without the visibility chip and without
 * the hidden-count affordance. The main zone opens the detail dialog (CLE-84)
 * and does not put `visibility` in the accessible name. «Куплю сам» is a sibling
 * and does not open the dialog.
 *
 * The server has already applied `VisibilityPolicy`: whatever arrives in
 * `gift` is allowed for this viewer. This component deliberately does not
 * inspect `gift.visibility`.
 */
export function PublicGiftCard({
  gift,
  width,
  listToken,
  loadDetail,
}: {
  gift: GiftCardData;
  width: number;
  /** When set, «Куплю сам» returns here with `?reserve=` after auth. */
  listToken?: string;
  /**
   * Signed-in refresh of one wish. Omit it for an anonymous visitor: the list
   * card is already everything the server allowed.
   */
  loadDetail?: () => Promise<DetailLoadResult>;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const cardRef = useRef<FocusTarget | null>(null);
  const t = useTranslations("app.myWishlist");
  const tGift = useTranslations("app.gift");
  const tWeb = useTranslations("web.wishlist");
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

  const showReserve =
    gift.quantity === "SINGLE" && gift.status === "OPEN";

  function detailParams(openReserve: boolean) {
    return {
      id: gift.id,
      ...(listToken ? { listToken } : {}),
      title: gift.title,
      ...(openReserve ? { openReserve: "1" } : {}),
    };
  }

  function openDetail() {
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
  }

  function returnToCard() {
    restoreFocus(cardRef.current);
  }

  function openReserveFlow() {
    router.push({ pathname: "/gifts/[id]", params: detailParams(true) });
  }

  return (
    <YStack gap="$2" width={width}>
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
        pressLabel={gift.title}
        pressRef={cardRef as never}
        onPress={openDetail}
      />
      {showReserve ? (
        <Button
          label={tWeb("buyMyself")}
          ariaLabel={tWeb("buyMyselfLabel", { title: gift.title })}
          variant="reserve"
          onPress={openReserveFlow}
        />
      ) : gift.quantity === "UNLIMITED" ? (
        <Text kind="label" tone="muted">
          {tGift("reserveNoButton.UNLIMITED")}
        </Text>
      ) : gift.status === "RESERVED" || gift.status === "CLOSED" ? (
        <Text kind="label" tone="muted">
          {tGift(`reserveNoButton.${gift.status}`)}
        </Text>
      ) : null}
      <WishDetailDialog
        open={detailOpen}
        viewer="guest"
        snapshot={gift}
        load={loadDetail}
        onClose={closeDetail}
        onClosed={returnToCard}
      />
    </YStack>
  );
}

PublicGiftCard.displayName = "PublicGiftCard";
