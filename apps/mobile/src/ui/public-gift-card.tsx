import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { Button, LinkText, TagChipList, WishCard as UiWishCard, YStack } from "@gift-list/ui";
import { router } from "expo-router";
import { useLocale, useTranslations } from "use-intl";
import { useAuth } from "@/session/auth-context";
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
  listToken,
}: {
  gift: GiftCardData;
  width: number;
  /** When set, «Куплю сам» returns here with `?reserve=` after auth. */
  listToken?: string;
}) {
  const t = useTranslations("app.myWishlist");
  const tGift = useTranslations("app.gift");
  const tWeb = useTranslations("web.wishlist");
  const locale = useLocale();
  const auth = useAuth();
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

  function openDetail() {
    router.push(`/gifts/${gift.id}`);
  }

  function openReserveFlow() {
    const reservePath = listToken
      ? `/wishlist/${listToken}?reserve=${encodeURIComponent(gift.id)}&title=${encodeURIComponent(gift.title)}`
      : `/gifts/${gift.id}?openReserve=1`;
    if (auth.state.status !== "ready") {
      router.push({ pathname: "/login", params: { next: reservePath } });
      return;
    }
    if (listToken) {
      router.push(reservePath);
      return;
    }
    router.push({ pathname: "/gifts/[id]", params: { id: gift.id, openReserve: "1" } });
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
        onPress={openDetail}
      />
      {showReserve ? (
        <Button
          label={tWeb("buyMyselfLabel", { title: gift.title })}
          variant="reserve"
          onPress={openReserveFlow}
        />
      ) : gift.quantity === "UNLIMITED" ? (
        <LinkText>{tGift("reserveNoButton.UNLIMITED")}</LinkText>
      ) : null}
    </YStack>
  );
}

PublicGiftCard.displayName = "PublicGiftCard";
