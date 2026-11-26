import type { ReservationCard as ReservationCardData } from "@gift-list/contracts";
import {
  Button,
  Column,
  EmptyState,
  Heading,
  LoadingCards,
  PageContainer,
  PageScroll,
  Pressable,
  SafeArea,
  Screen,
  Text,
  XStack,
  YStack,
  type FocusTarget,
} from "@gift-list/ui";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { CardGridList } from "@/ui/card-grid-list";
import { NotificationBell } from "@/ui/notification-bell";
import { ReservationCard } from "@/ui/reservation-card";
import type { ReservationVisibilityValues } from "@/ui/reservation-visibility";
import { SiteFooter } from "@/ui/site-footer";
import { useCardGrid } from "@/ui/use-card-grid";

/** The list of «Мои брони»: a skeleton, a retry view, the empty state or the cards. */
export type ReservationsState =
  | { status: "loading" }
  | { status: "ready"; reservations: ReservationCardData[] }
  | { status: "error"; kind: "network" | "generic" };

export type ReservationsScreenProps = {
  state: ReservationsState;
  /** The holder's zone: the card counts «срок прошёл» there and offers no extension. */
  timeZone: string;
  /** The cards with a request in flight; every other card stays usable. */
  busyIds: ReadonlySet<string>;
  onRetry: () => void;
  /**
   * The «К моему вишлисту» link of a nested screen. «Брони» is a tab root now, so
   * the route passes nothing and the footer link is not drawn (spec 6.2 →
   * TAB_ROOT_NO_BACK); a standalone preview may still hand one in.
   */
  onBack?: () => void;
  onOpenGift: (card: ReservationCardData) => void;
  onMenu: (card: ReservationCardData) => void;
  onExtend: (card: ReservationCardData) => void;
  /** «Подарил» (Story 5.7): the card is replaced by the `GIVEN` answer. */
  onGiven: (card: ReservationCardData) => void;
  onBoughtChange: (card: ReservationCardData, value: boolean) => void;
  onVisibilityChange: (card: ReservationCardData, next: ReservationVisibilityValues) => void;
  /** Registers the ⋮ of a card, so the screen can return focus after its menu closes. */
  menuRefFor?: (giftId: string) => (node: FocusTarget | null) => void;
};

/**
 * «Мои брони» (Story 5.5, `DESIGN.md` → ReservationCard, `EXPERIENCE.md` →
 * State Patterns): страница держателя — бренд, заголовок, карточки броней. Экран
 * только рисует переданное состояние и сообщает о нажатиях; сессия, запросы, слои
 * и busy принадлежат маршруту, поэтому история не может отправить два запроса.
 *
 * Пустой список — «Броней нет» с подсказкой про «Куплю сам», ошибка — «Не
 * получилось загрузить» + «Повторить», загрузка — скелет карточек той же формы.
 */
export function ReservationsScreen({
  state,
  timeZone,
  busyIds,
  onRetry,
  onBack,
  onOpenGift,
  onMenu,
  onExtend,
  onGiven,
  onBoughtChange,
  onVisibilityChange,
  menuRefFor,
}: ReservationsScreenProps) {
  const t = useTranslations("app.reservations");
  const tGift = useTranslations("app.gift");
  const common = useTranslations("common");
  const brand = getBrandName();
  // W12.23: the browser measures the column the cards stand in, so a classic
  // scrollbar cannot push the right column past the gutter (`DESIGN.md` → Layout).
  const { cardWidth, attachContainer } = useCardGrid();

  let content: ReactNode;
  if (state.status === "loading") {
    content = (
      <LoadingCards
        testID="reservations-loading"
        label={t("loading")}
        width={cardWidth}
        count={4}
      />
    );
  } else if (state.status === "error") {
    content = (
      <YStack width="100%" maxWidth="$max-form" alignSelf="center" paddingVertical="$4" gap="$grid-gap">
        <Text tone="muted" textAlign="center" testID="reservations-load-error">
          {state.kind === "network" ? t("loadError") : t("loadErrorGeneric")}
        </Text>
        <Button label={t("retry")} onPress={onRetry} testID="reservations-retry" />
      </YStack>
    );
  } else if (state.reservations.length === 0) {
    content = <EmptyState title={t("emptyTitle")} body={t("emptyText")} />;
  } else {
    content = (
      <CardGridList testID="reservations-list">
        {state.reservations.map(function renderReservation(card) {
          const busy = busyIds.has(card.giftId);
          return (
            <ReservationCard
              key={card.giftId}
              testID={`reservation-${card.giftId}`}
              card={card}
              busy={busy}
              timeZone={timeZone}
              width={cardWidth}
              menuRef={menuRefFor ? menuRefFor(card.giftId) : undefined}
              onOpenGift={function openGift() {
                onOpenGift(card);
              }}
              onMenu={function openMenu() {
                onMenu(card);
              }}
              onExtend={function extend() {
                onExtend(card);
              }}
              onGiven={function markGiven() {
                onGiven(card);
              }}
              onBoughtChange={function changeBought(value) {
                onBoughtChange(card, value);
              }}
              onVisibilityChange={function changeVisibility(next) {
                onVisibilityChange(card, next);
              }}
            />
          );
        })}
      </CardGridList>
    );
  }

  return (
    <Screen>
      {/* The shell decides the bottom edge: the bar holds it, or the frame does
          on an expanded screen without the bar (AD-30). */}
      <SafeArea>
        <Stack.Screen options={{ title: t("pageTitle", { brand }) }} />
        <PageScroll testID="reservations-page">
          <PageContainer>
            <Column
              size="content"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              {onBack ? (
                <Pressable
                  role="button"
                  aria-label={tGift("backToList")}
                  onPress={onBack}
                  alignSelf="flex-start"
                  justifyContent="center"
                  minHeight="$touch-target"
                  minWidth="$touch-target"
                  testID="reservations-back"
                >
                  <Text kind="button" tone="primary">
                    {tGift("backToList")}
                  </Text>
                </Pressable>
              ) : null}
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <XStack justifyContent="space-between" alignItems="center">
                <Heading level={1}>{t("title")}</Heading>
                <NotificationBell />
              </XStack>
              <YStack
                testID="reservations-content"
                ref={attachContainer}
                paddingTop="$2"
                paddingBottom="$section-gap"
                gap="$grid-gap"
                flexGrow={1}
              >
                {content}
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeArea>
    </Screen>
  );
}

ReservationsScreen.displayName = "ReservationsScreen";

