import type { ReservationCard as ReservationCardData } from "@gift-list/contracts";
import {
  Button,
  Column,
  EmptyState,
  Heading,
  PageContainer,
  PageScroll,
  Pressable,
  SafeArea,
  Screen,
  Skeleton,
  Text,
  YStack,
  type FocusTarget,
} from "@gift-list/ui";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { ReservationCard } from "@/ui/reservation-card";
import type { ReservationVisibilityValues } from "@/ui/reservation-visibility";
import { SiteFooter } from "@/ui/site-footer";

/** The list of «Мои брони»: a skeleton, a retry view, the empty state or the cards. */
export type ReservationsState =
  | { status: "loading" }
  | { status: "ready"; reservations: ReservationCardData[] }
  | { status: "error"; kind: "network" | "generic" };

export type ReservationsScreenProps = {
  state: ReservationsState;
  /** The cards whose «Кто видит, что это я» block is open. */
  expanded: ReadonlySet<string>;
  /** The cards with a request in flight; every other card stays usable. */
  busyIds: ReadonlySet<string>;
  onRetry: () => void;
  onBack: () => void;
  onOpenGift: (card: ReservationCardData) => void;
  onMenu: (card: ReservationCardData) => void;
  onExtend: (card: ReservationCardData) => void;
  onToggleVisibility: (giftId: string) => void;
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
  expanded,
  busyIds,
  onRetry,
  onBack,
  onOpenGift,
  onMenu,
  onExtend,
  onToggleVisibility,
  onBoughtChange,
  onVisibilityChange,
  menuRefFor,
}: ReservationsScreenProps) {
  const t = useTranslations("app.reservations");
  const tGift = useTranslations("app.gift");
  const common = useTranslations("common");
  const brand = getBrandName();

  let content: ReactNode;
  if (state.status === "loading") {
    content = <ReservationSkeleton label={t("loading")} />;
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
      <YStack role="list" gap="$grid-gap" width="100%" testID="reservations-list">
        {state.reservations.map(function renderReservation(card) {
          const busy = busyIds.has(card.giftId);
          return (
            <ReservationCard
              key={card.giftId}
              testID={`reservation-${card.giftId}`}
              card={card}
              busy={busy}
              menuRef={menuRefFor ? menuRefFor(card.giftId) : undefined}
              visibilityExpanded={expanded.has(card.giftId)}
              onToggleVisibility={function toggleVisibility() {
                onToggleVisibility(card.giftId);
              }}
              onOpenGift={function openGift() {
                onOpenGift(card);
              }}
              onMenu={function openMenu() {
                onMenu(card);
              }}
              onExtend={function extend() {
                onExtend(card);
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
      </YStack>
    );
  }

  return (
    <Screen>
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
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <Heading level={1}>{t("title")}</Heading>
              <YStack
                testID="reservations-content"
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

/**
 * «EXPERIENCE.md» → Cold load: the skeleton of the expected layout, not anonymous
 * boxes. Two cards of the same frame and line rhythm as the real one; the region is
 * a named busy area for assistive tech.
 */
function ReservationSkeleton({ label }: { label: string }) {
  return (
    <YStack role="status" aria-busy aria-label={label} gap="$grid-gap" testID="reservations-loading">
      {[0, 1].map(function skeletonKey(key) {
        return (
          <YStack
            key={key}
            width="100%"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
            backgroundColor="$surface"
            padding="$card-padding"
            gap="$2"
          >
            <Skeleton height={22} width="70%" />
            <Skeleton height={18} width="40%" />
            <Skeleton height={18} width="55%" />
          </YStack>
        );
      })}
    </YStack>
  );
}

ReservationSkeleton.displayName = "ReservationSkeleton";
