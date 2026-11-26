import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import {
  Button,
  TagChipList,
  Text,
  WishCard as UiWishCard,
  XStack,
  YStack,
} from "@gift-list/ui";
import { Link, router } from "expo-router";
import { useLocale, useTranslations } from "use-intl";
import { NavLink } from "@/ui/nav-link";
import { StatusPill } from "@/ui/status-pill";

/**
 * Story 3.3 / DESIGN → `/l/{token}`: the link visitor sees the same
 * `packages/ui` card as the owner, but without the visibility chip and without
 * the hidden-count affordance. The main zone is a real link to the wish page
 * `/gifts/{id}` (CLE-129, T4.4) and does not put `visibility` in the accessible
 * name. «Куплю сам» is a sibling and does not open the page.
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
  /** When set, the page and «Куплю сам» return here with `?reserve=` after auth. */
  listToken?: string;
}) {
  const t = useTranslations("app.myWishlist");
  const tGift = useTranslations("app.gift");
  const tWeb = useTranslations("web.wishlist");
  const locale = useLocale();
  const price =
    gift.priceAmount !== null && gift.priceCurrency !== null
      ? formatPrice(gift.priceAmount, gift.priceCurrency, locale)
      : null;
  // Story 5.7 / «Подписи брони»: the guest sees the stage «Подарено» (and
  // «Куплено» since Story 5.5) by `reservationLabel`; the holder's name stays a
  // separate line and follows the «Показывать другим гостям, что дарю я» toggle.
  const stage = gift.reservationLabel
    ? tGift(`detail.reservationLabel.${gift.reservationLabel}` as "detail.reservationLabel.BOUGHT")
    : null;
  const reservation =
    stage !== null || gift.reservedBy !== null ? (
      <YStack gap="$1">
        {stage !== null ? (
          <Text kind="label" tone="reserved" testID="gift-reservation-stage">
            {stage}
          </Text>
        ) : null}
        {gift.reservedBy ? (
          // CLE-129, T4.2 / D-55: the holder's name is a link to `/u/{nick}`. It sits
          // next to the card button, not inside it, so the link stays reachable by Tab.
          <XStack gap="$1" alignItems="center" flexWrap="wrap" testID="gift-reserved-by">
            <Text kind="label" tone="reserved">
              {t("reservedByPrefix")}
            </Text>
            <NavLink href={`/u/${encodeURIComponent(gift.reservedBy.nick)}`}>
              {gift.reservedBy.displayName}
            </NavLink>
          </XStack>
        ) : null}
      </YStack>
    ) : null;
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

  function openReserveFlow() {
    router.push({ pathname: "/gifts/[id]", params: detailParams(true) });
  }

  return (
    <YStack gap="$2" width={width}>
      {/*
        The router's `Link` hands `href` and `onPress` to the card; on the web that
        is a real `<a href>`, so the wish opens in a new tab like any link
        (CLE-129, T4.4), while the router keeps in-app navigation for a plain click.
      */}
      <Link href={{ pathname: "/gifts/[id]", params: detailParams(false) }} asChild>
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
        />
      </Link>
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
    </YStack>
  );
}

PublicGiftCard.displayName = "PublicGiftCard";
