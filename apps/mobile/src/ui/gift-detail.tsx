import { formatPrice, type DetailViewer, type GiftCard } from "@gift-list/contracts";
import { Button, Heading, TagChipList, Text, YStack } from "@gift-list/ui";
import { openURL } from "expo-linking";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { NavLink } from "@/ui/nav-link";
import { StatusPill } from "@/ui/status-pill";

/**
 * Кто видит желание — текст, а не чип: чип с карточки убран (D-54), а на своей
 * странице владелец должен видеть, кому желание открыто (EXPERIENCE → «Страница
 * желания», D-63).
 */
const VISIBILITY_KEY = {
  PUBLIC: "visibility.PUBLIC",
  FRIENDS: "visibility.FRIENDS",
  SECRET: "visibility.SECRET",
} as const;

export type GiftDetailProps = {
  gift: GiftCard;
  viewer: DetailViewer;
  /**
   * Блоки зрителя между полями и действиями: строка держателя и бронь. Владелец
   * ничего из этого не получает (AD-15, D-49), поэтому блоки приходят сюда только
   * от экрана гостя и здесь не строятся.
   */
  children?: ReactNode;
  /** Действия этого зрителя: «Куплю сам», «Снять бронь», «Изменить». */
  actions?: ReactNode;
};

/**
 * Тело страницы желания `/gifts/{id}` (D-63): одни и те же поля для владельца и
 * гостя — название, описание, цена, ссылка на магазин, статус, теги. Только
 * владельцу показывается «Кто видит». Признаков брони здесь нет: даже если
 * сервер по ошибке пришлёт `RESERVED` с держателем, владелец прочитает желание
 * как открытое — та же вторая проверка, что в `toDetailFacts`.
 *
 * «Фото» в контракте желания пока нет (`giftCardSchema` без `photoUrl`), поэтому
 * страница его не рисует и заглушку не выдумывает.
 */
export function GiftDetail({ gift, viewer, children, actions }: GiftDetailProps) {
  const tGift = useTranslations("app.gift");
  const locale = useLocale();
  const link = gift.linkUrl;
  const status = viewer === "owner" && gift.status === "RESERVED" ? "OPEN" : gift.status;

  return (
    <YStack gap="$4" flexGrow={1} testID="gift-detail">
      <Heading level={1} kind="display-sm">
        {gift.title}
      </Heading>
      {gift.description ? <Text kind="body">{gift.description}</Text> : null}
      {gift.priceAmount !== null && gift.priceCurrency !== null ? (
        <Text kind="label" tone="muted">
          {formatPrice(gift.priceAmount, gift.priceCurrency, locale)}
        </Text>
      ) : null}
      {link ? (
        <YStack gap="$1">
          <Text kind="label" tone="muted">
            {tGift("detail.link")}
          </Text>
          {/* The web keeps a real `<a href>`; a phone hands the URL to the system browser. */}
          <Button
            label={link}
            href={link}
            variant="ghost"
            ariaLabel={`${tGift("detail.link")}: ${link}`}
            onPress={
              Platform.OS === "web"
                ? undefined
                : function openShopLink() {
                    void openURL(link);
                  }
            }
          />
        </YStack>
      ) : null}
      <StatusPill status={status} />
      {gift.tags.length > 0 ? (
        <TagChipList
          labels={gift.tags.map(function tagLabel(tag) {
            return tag.label;
          })}
          moreLabel={function moreTags(count: number) {
            return tGift("tagsMore", { count });
          }}
        />
      ) : null}
      {viewer === "owner" ? (
        <YStack gap="$1" testID="gift-visibility">
          <Text kind="label" tone="muted">
            {tGift("detail.visibility")}
          </Text>
          <Text kind="body">{tGift(VISIBILITY_KEY[gift.visibility])}</Text>
        </YStack>
      ) : null}
      {children}
      <YStack flexGrow={1} />
      {actions}
      <NavLink href="/">{tGift("backToList")}</NavLink>
    </YStack>
  );
}

GiftDetail.displayName = "GiftDetail";
