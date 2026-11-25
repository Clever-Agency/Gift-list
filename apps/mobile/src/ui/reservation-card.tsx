import { formatDate, type ReservationCard as ReservationCardData } from "@gift-list/contracts";
import {
  Button,
  Pressable,
  Switch,
  TagChip,
  Text,
  XStack,
  YStack,
  type FocusTarget,
} from "@gift-list/ui";
import { useLocale, useTranslations } from "use-intl";
import {
  ReservationVisibility,
  type ReservationVisibilityValues,
} from "@/ui/reservation-visibility";

export type ReservationCardProps = {
  card: ReservationCardData;
  /** A request of this card is in flight: every control of the card is blocked. */
  busy?: boolean;
  /** «Кто видит, что это я» is open (the screen owns the state of each card). */
  visibilityExpanded: boolean;
  onToggleVisibility: () => void;
  /** Opens the wish detail; the card only makes a link of it when `canOpenGift`. */
  onOpenGift?: () => void;
  /** Opens the ⋮ menu of the screen; without it the card has no menu button. */
  onMenu?: () => void;
  /** «Продлить до…»; absent in `GIVEN`, where the server would answer `CONFLICT`. */
  onExtend?: () => void;
  onBoughtChange: (value: boolean) => void;
  onVisibilityChange: (next: ReservationVisibilityValues) => void;
  /** The ⋮, so the screen's menu can return focus to it. */
  menuRef?: (node: FocusTarget | null) => void;
  testID?: string;
};

/**
 * Карточка одной брони держателя (Story 5.5, `DESIGN.md` → ReservationCard,
 * `EXPERIENCE.md` → «Подписи брони»): снимок названия, `@ник` владельца, срок,
 * фаза, чип «Куплено», свёрнутый переключатель «Кто видит, что это я» и действия
 * «Купил», «Продлить до…», «Снять бронь» (⋮). Без цены, тегов и остальных
 * желаний: набор полей задан контрактом `reservationCardSchema` (A-14, AD-7).
 *
 * Основная зона — ссылка на деталь только при `canOpenGift`: после unfriend,
 * Block или сужения видимости сервер отвечает `false`, и тогда карточка не
 * ссылается никуда, а действия остаются на месте.
 *
 * Компонент ничего не запрашивает: `busy`, раскрытие переключателей и сами
 * действия принадлежат экрану, поэтому одна карточка не может отправить два
 * запроса.
 */
export function ReservationCard({
  card,
  busy,
  visibilityExpanded,
  onToggleVisibility,
  onOpenGift,
  onMenu,
  onExtend,
  onBoughtChange,
  onVisibilityChange,
  menuRef,
  testID,
}: ReservationCardProps) {
  const t = useTranslations("app.reservations");
  const tGift = useTranslations("app.gift");
  const tPhase = useTranslations("app.gift.detail.phase");
  const locale = useLocale();
  // «до DD.MM»: the short day of `DESIGN.md` → ReservationCard. The detail keeps
  // the full date; one contract function formats both (Story 5.5, open question 6).
  const due = formatDate(card.dueAt, locale, { year: false });
  // `ACTIVE` already reads «Вы берёте · до DD.MM», so its due line is not repeated.
  const active = card.phase === "ACTIVE";
  const open = card.canOpenGift ? onOpenGift : undefined;
  // `GIVEN` waits for the owner's confirmation (Story 5.7): an extension would
  // silently restart its timers, so the server answers `CONFLICT` and the button
  // is not offered (`EXPERIENCE.md` → «Подписи брони»).
  const extend = card.phase === "GIVEN" ? undefined : onExtend;

  const content = (
    <>
      <Text kind="body-strong" numberOfLines={2}>
        {card.titleSnapshot}
      </Text>
      <Text kind="caption" tone="muted">
        {t("owner", { nick: card.ownerNick })}
      </Text>
      {active ? (
        <Text kind="label" tone="reserved">
          {tPhase("ACTIVE", { date: due })}
        </Text>
      ) : (
        <YStack gap="$1">
          <Text kind="label" tone="reserved">
            {t("due", { date: due })}
          </Text>
          <Text kind="caption" tone="muted">
            {tPhase(card.phase)}
          </Text>
        </YStack>
      )}
    </>
  );

  return (
    <YStack
      role="listitem"
      testID={testID}
      width="100%"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      backgroundColor="$surface"
      padding="$card-padding"
      gap="$2"
    >
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
        {open ? (
          <Pressable
            role="link"
            aria-label={t("openGift", { title: card.titleSnapshot })}
            onPress={open}
            disabled={busy}
            flex={1}
            minWidth={0}
            gap="$1"
            testID={testID ? `${testID}-link` : undefined}
          >
            {content}
          </Pressable>
        ) : (
          <YStack flex={1} minWidth={0} gap="$1">
            {content}
          </YStack>
        )}
        {onMenu ? (
          <Pressable
            ref={menuRef}
            role="button"
            aria-label={tGift("closed.menuLabel")}
            aria-haspopup="dialog"
            onPress={onMenu}
            disabled={busy}
            width="$touch-target"
            height="$touch-target"
            alignItems="center"
            justifyContent="center"
            testID={testID ? `${testID}-menu` : undefined}
          >
            <Text aria-hidden>⋯</Text>
          </Pressable>
        ) : null}
      </XStack>
      {card.bought ? <TagChip variant="card" label={t("boughtChip")} /> : null}
      <Switch
        label={t("bought")}
        checked={card.bought}
        disabled={busy}
        onChange={onBoughtChange}
        testID={testID ? `${testID}-bought` : undefined}
      />
      {extend ? (
        <Button
          variant="outline"
          label={t("extend")}
          onPress={extend}
          disabled={busy}
          testID={testID ? `${testID}-extend` : undefined}
        />
      ) : null}
      <ReservationVisibility
        expanded={visibilityExpanded}
        onToggle={onToggleVisibility}
        values={{
          holderVisibleToOthers: card.holderVisibleToOthers,
        }}
        busy={busy}
        onChange={onVisibilityChange}
        testID={testID ? `${testID}-visibility` : undefined}
      />
    </YStack>
  );
}

ReservationCard.displayName = "ReservationCard";
