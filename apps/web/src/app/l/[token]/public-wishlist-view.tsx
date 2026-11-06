"use client";

import { createTranslator } from "next-intl";
import { formatPrice, getMessages, type GiftCard, type SupportedLocale } from "@gift-list/contracts";
import {
  Column,
  EmptyState,
  Heading,
  LinkText,
  Screen,
  StatusPill,
  TagChipList,
  Text,
  WishCard,
  XStack,
  YStack,
} from "@gift-list/ui";
import type { LinkView } from "./link-page";

export type PublicWishlistData = Exclude<LinkView, { kind: "redirect" }>;

/** The wire status is upper-case; the visual pill takes the lower-case tone. */
const STATUS_PILL = {
  OPEN: "open",
  RESERVED: "reserved",
  CLOSED: "closed",
} as const;

export type PublicWishlistViewProps = {
  view: PublicWishlistData;
  locale: SupportedLocale;
  /** `/wishlist/{token}` of the validated segment, or null for a bad segment. */
  wishlistPath: string | null;
};

/**
 * Story 3.3: the anonymous link page, built from the same `packages/ui` cards as
 * the app screen. The owner is the one `h1`, the nick is a caption, and the grid
 * is plain list content: no visibility chip and no hidden count. «Куплю сам» is
 * a relative link to the SPA route (AD-26), only for a single open wish; the
 * booking and friendship confirm flows belong to Epic 5 and AD-21 forbids
 * creating a friendship from `/l`.
 */
export function PublicWishlistView({ view, locale, wishlistPath }: PublicWishlistViewProps) {
  const messages = getMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "web.wishlist" });

  if (view.kind === "not_found") {
    return (
      <Screen role="main">
        <Column size="wide" paddingVertical="$section-gap">
          <Heading level={1} kind="display-sm" textAlign="center">
            {t("notFound")}
          </Heading>
        </Column>
      </Screen>
    );
  }

  const tGift = createTranslator({ locale, messages, namespace: "app.gift" });
  const tWishlist = createTranslator({ locale, messages, namespace: "app.myWishlist" });

  function moreTagLabel(hiddenCount: number): string {
    return tGift("tagsMore", { count: hiddenCount });
  }

  function moreTagAccessibilityLabel(
    hiddenCount: number,
    hiddenLabels: readonly string[],
  ): string {
    return tGift("tagsMoreLabel", { count: hiddenCount, tags: hiddenLabels.join(", ") });
  }

  function renderGift(gift: GiftCard) {
    const price =
      gift.priceAmount !== null && gift.priceCurrency !== null
        ? formatPrice(gift.priceAmount, gift.priceCurrency, locale)
        : null;
    const tagLabels = gift.tags.map(function labelOfTag(tag) {
      return tag.label;
    });
    const reservation = gift.reservedBy
      ? tWishlist("reservedBy", { name: gift.reservedBy.displayName })
      : null;
    const href =
      gift.quantity === "SINGLE" && gift.status === "OPEN" ? wishlistPath : null;

    return (
      <YStack
        key={gift.id}
        role="presentation"
        flexBasis={280}
        flexGrow={1}
        minWidth={0}
        maxWidth="100%"
        gap="$2"
      >
        <WishCard
          title={gift.title}
          closed={gift.status === "CLOSED"}
          price={price}
          status={
            <StatusPill
              status={STATUS_PILL[gift.status]}
              label={messages.app.gift.status[gift.status]}
            />
          }
          tags={
            tagLabels.length > 0 ? (
              <TagChipList
                labels={tagLabels}
                moreLabel={moreTagLabel}
                moreAccessibilityLabel={moreTagAccessibilityLabel}
              />
            ) : undefined
          }
          reservation={reservation}
          width="100%"
        />
        {href ? (
          <a
            href={href}
            aria-label={t("buyMyselfLabel", { title: gift.title })}
            style={{ textDecoration: "none", alignSelf: "flex-start" }}
          >
            <LinkText>{t("buyMyself")}</LinkText>
          </a>
        ) : null}
      </YStack>
    );
  }

  return (
    <Screen role="main">
      <Column size="wide" paddingVertical="$section-gap" gap="$section-gap">
        <YStack gap="$1">
          <Heading level={1} kind="display-sm">
            {view.owner.displayName}
          </Heading>
          <Text kind="caption" tone="muted">
            {t("nick", { nick: view.owner.nick })}
          </Text>
        </YStack>
        {view.gifts.length === 0 ? (
          <EmptyState title={t("emptyTitle")} />
        ) : (
          <XStack role="list" flexWrap="wrap" gap="$grid-gap" alignItems="flex-start">
            {view.gifts.map(renderGift)}
          </XStack>
        )}
      </Column>
    </Screen>
  );
}

PublicWishlistView.displayName = "PublicWishlistView";
