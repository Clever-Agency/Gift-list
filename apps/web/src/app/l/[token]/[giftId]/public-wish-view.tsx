"use client";

import { createTranslator } from "next-intl";
import {
  formatPrice,
  getMessages,
  type GiftCard,
  type SupportedLocale,
} from "@gift-list/contracts";
import {
  Button,
  Column,
  Heading,
  LinkText,
  StatusPill,
  TagChipList,
  Text,
  XStack,
  YStack,
} from "@gift-list/ui";
import { PublicPageFrame } from "@/components/public-page-frame";

export type PublicWishData = {
  owner: { displayName: string; nick: string };
  gift: GiftCard;
};

/** The wire status is upper-case; the visual pill takes the lower-case tone. */
const STATUS_PILL = {
  OPEN: "open",
  RESERVED: "reserved",
  CLOSED: "closed",
} as const;

export type PublicWishViewProps = {
  view: PublicWishData;
  locale: SupportedLocale;
  /** `/l/{token}` of the validated segment, or null for a bad segment. */
  listPath: string | null;
  /** `/wishlist/{token}` of the validated segment, or null for a bad segment. */
  wishlistPath: string | null;
};

/**
 * D-63 / AD-15 (14): the anonymous page of one wish, rendered by Next for the
 * link visitor. It shows only the fields the list read already allowed for this
 * link — the same card the grid of `/l` renders — so nothing here is a new
 * disclosure: title, description, price, shop link, status, tags and the
 * holder line (while the holder shares it). There is no visibility chip, no
 * archive instant and no quantity: those are owner-only or dialog leftovers.
 *
 * «Куплю сам» is a separate link to the SPA route, exactly like the card of
 * `/l` (AD-26): without a session it leads to the app sign-in and returns to
 * the list with the confirm of this wish open. The one back link returns to
 * `/l/{token}`.
 */
export function PublicWishView({ view, locale, listPath, wishlistPath }: PublicWishViewProps) {
  const messages = getMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "web.wishlist" });
  const tGift = createTranslator({ locale, messages, namespace: "app.gift" });
  const tWishlist = createTranslator({ locale, messages, namespace: "app.myWishlist" });
  const { gift, owner } = view;

  const price =
    gift.priceAmount !== null && gift.priceCurrency !== null
      ? formatPrice(gift.priceAmount, gift.priceCurrency, locale)
      : null;
  const tagLabels = gift.tags.map(function labelOfTag(tag) {
    return tag.label;
  });
  // Story 5.7 / «Подписи брони»: a link visitor sees the stage «Подарено» (and
  // «Куплено» since Story 5.5) from `reservationLabel`; the shared holder name is
  // a separate line and follows the «Показывать другим гостям, что дарю я» toggle.
  const stage = gift.reservationLabel
    ? messages.app.gift.detail.reservationLabel[gift.reservationLabel]
    : null;
  const reservation =
    stage !== null || gift.reservedBy !== null ? (
      <YStack gap="$1">
        {stage !== null ? (
          <Text kind="label" tone="reserved">
            {stage}
          </Text>
        ) : null}
        {gift.reservedBy ? (
          <XStack gap="$1" alignItems="center" flexWrap="wrap">
            <Text kind="label" tone="reserved">
              {tWishlist("reservedByPrefix")}
            </Text>
            <a
              href={`/u/${encodeURIComponent(gift.reservedBy.nick)}`}
              style={{ textDecoration: "none" }}
            >
              <LinkText>{gift.reservedBy.displayName}</LinkText>
            </a>
          </XStack>
        ) : null}
      </YStack>
    ) : null;
  const buyHref =
    gift.quantity === "SINGLE" && gift.status === "OPEN" && wishlistPath
      ? `${wishlistPath}?reserve=${encodeURIComponent(gift.id)}&title=${encodeURIComponent(gift.title)}`
      : null;

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
    <PublicPageFrame locale={locale}>
      <Column size="content" flexGrow={1} paddingVertical="$section-gap" gap="$section-gap">
        {listPath ? (
          <a href={listPath} style={{ textDecoration: "none", alignSelf: "flex-start" }}>
            <LinkText>{t("backToList")}</LinkText>
          </a>
        ) : null}
        <YStack gap="$1">
          <XStack gap="$2" alignItems="baseline" flexWrap="wrap">
            <Text kind="label">{owner.displayName}</Text>
            <Text kind="caption" tone="muted">
              {t("nick", { nick: owner.nick })}
            </Text>
          </XStack>
          <Heading level={1} kind="display-sm">
            {gift.title}
          </Heading>
        </YStack>
        <YStack gap="$3">
          {gift.description ? <Text kind="body">{gift.description}</Text> : null}
          {price ? (
            <Text kind="label" tone="muted">
              {price}
            </Text>
          ) : null}
          {gift.linkUrl ? (
            <YStack gap="$1">
              <Text kind="label" tone="muted">
                {tGift("detail.link")}
              </Text>
              <Button
                label={gift.linkUrl}
                href={gift.linkUrl}
                variant="ghost"
                ariaLabel={`${tGift("detail.link")}: ${gift.linkUrl}`}
              />
            </YStack>
          ) : null}
          <StatusPill
            status={STATUS_PILL[gift.status]}
            label={messages.app.gift.status[gift.status]}
          />
          {tagLabels.length > 0 ? (
            <TagChipList
              labels={tagLabels}
              moreLabel={moreTagLabel}
              moreAccessibilityLabel={moreTagAccessibilityLabel}
            />
          ) : null}
          {reservation}
          {buyHref ? (
            <a
              href={buyHref}
              aria-label={t("buyMyselfLabel", { title: gift.title })}
              style={{ textDecoration: "none", alignSelf: "flex-start" }}
            >
              <LinkText>{t("buyMyself")}</LinkText>
            </a>
          ) : null}
        </YStack>
      </Column>
    </PublicPageFrame>
  );
}

PublicWishView.displayName = "PublicWishView";
