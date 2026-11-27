"use client";

import { createTranslator } from "next-intl";
import {
  formatPrice,
  type GiftCard,
  type SupportedLocale,
} from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import {
  Column,
  EmptyState,
  Heading,
  LinkText,
  StatusPill,
  TagChipList,
  Text,
  WishCard,
  XStack,
  YStack,
} from "@gift-list/ui";
import { PublicPageFrame } from "@/components/public-page-frame";
import type { LinkView } from "./link-page";

export type PublicWishlistData = Extract<LinkView, { kind: "gifts" }>;

/** The wire status is upper-case; the visual pill takes the lower-case tone. */
const STATUS_PILL = {
  OPEN: "open",
  RESERVED: "reserved",
  CLOSED: "closed",
} as const;

export type PublicWishlistViewProps = {
  view: PublicWishlistData;
  locale: SupportedLocale;
  /** `/l/{token}` of the validated segment, or null for a bad segment. */
  listPath: string | null;
  /** `/wishlist/{token}` of the validated segment, or null for a bad segment. */
  wishlistPath: string | null;
};

/**
 * Story 3.3: the anonymous link page, built from the same `packages/ui` cards as
 * the app screen. The owner is the one `h1`, the nick is a caption, and the grid
 * is plain list content: no visibility chip and no hidden count.
 *
 * CLE-129, T4.5 / D-63: the press zone of a card is a real link to
 * `/l/{token}/{giftId}`, the server page of that one wish; the detail dialog of
 * CLE-84 is gone. «Куплю сам» stays a separate link to the SPA route (AD-26) and
 * does not open the page. It is only for a single open wish; the booking and
 * friendship confirm flows belong to Epic 5 and AD-21 forbids creating a
 * friendship from `/l`.
 *
 * Only a found list reaches this view: an unknown token, a malformed segment and
 * a `Block` are the real 404 of `not-found.tsx` (CLE-103), so the page never
 * renders the closed gate inside a 200 response.
 */
export function PublicWishlistView({
  view,
  locale,
  listPath,
  wishlistPath,
}: PublicWishlistViewProps) {
  const messages = getWebMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "web.wishlist" });

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
    // Story 5.7 / «Подписи брони»: the guest sees the stage «Подарено» (and
    // «Куплено» since Story 5.5) by `reservationLabel`; the shared holder name is
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
    const href =
      gift.quantity === "SINGLE" && gift.status === "OPEN" && wishlistPath
        ? `${wishlistPath}?reserve=${encodeURIComponent(gift.id)}&title=${encodeURIComponent(gift.title)}`
        : null;
    // CLE-129, T4.5 / D-63: the press zone of the card is a real `<a>` to the
    // page of this one wish, so the list keeps the same one press as the app.
    const cardHref = listPath ? `${listPath}/${encodeURIComponent(gift.id)}` : undefined;

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
          pressLabel={gift.title}
          href={cardHref}
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
    <PublicPageFrame locale={locale}>
      <Column size="wide" flexGrow={1} paddingVertical="$section-gap" gap="$section-gap">
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
    </PublicPageFrame>
  );
}

PublicWishlistView.displayName = "PublicWishlistView";
