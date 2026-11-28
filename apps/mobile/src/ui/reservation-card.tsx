import {
  formatDate,
  formatPrice,
  type ReservationCard as ReservationCardData,
} from "@gift-list/contracts";
import {
  Button,
  Pressable,
  Switch,
  TagChip,
  Text,
  WishCard,
  XStack,
  YStack,
  type FocusTarget,
} from "@gift-list/ui";
import { useLocale, useTranslations } from "use-intl";
import { NavLink } from "@/ui/nav-link";
import { canExtendReservation } from "@/ui/reservation-extend-dialog";
import {
  ReservationVisibility,
  type ReservationVisibilityValues,
} from "@/ui/reservation-visibility";

export type ReservationCardProps = {
  card: ReservationCardData;
  /** A request of this card is in flight: every control of the card is blocked. */
  busy?: boolean;
  /** The holder's zone: the deadline day (`dueAt`) and «срок прошёл» are counted there. */
  timeZone?: string;
  /** Opens the wish detail; the card only makes a link of it when `canOpenGift`. */
  onOpenGift?: () => void;
  /** Opens the ⋮ menu of the screen; without it the card has no menu button. */
  onMenu?: () => void;
  /**
   * «Продлить до…»; absent in `GIVEN` and once the deadline day has passed, where
   * the server answers `RESERVATION_DUE_PASSED` (D-12, CLE-124/S9b-3).
   */
  onExtend?: () => void;
  /** «Подарил» (Story 5.7): absent in `GIVEN`, where the stage already says «Подарено». */
  onGiven?: () => void;
  onBoughtChange: (value: boolean) => void;
  onVisibilityChange: (next: ReservationVisibilityValues) => void;
  /** The ⋮, so the screen's menu can return focus to it. */
  menuRef?: (node: FocusTarget | null) => void;
  /** Whether this card's ⋮ menu is open: the trigger then reports `aria-expanded`. */
  menuExpanded?: boolean;
  /** «Продлить до…», so the screen's dialog can return focus to it. */
  extendRef?: (node: FocusTarget | null) => void;
  /** The card width: the «Мои брони» grid passes the measured column (`useCardGrid`). */
  width?: number | string;
  testID?: string;
};

/** The comma-separated accessible name, without empty parts (`DESIGN.md` → Доступность). */
function joinCardName(parts: readonly (string | null)[]): string {
  return parts
    .filter(function hasText(part): part is string {
      return part !== null && part.trim() !== "";
    })
    .join(", ");
}

/**
 * Карточка одной брони держателя (Story 5.5, D-56, `DESIGN.md` → ReservationCard,
 * `EXPERIENCE.md` → «Подписи брони»): та же v8-карточка желания (`WishCard`) —
 * фото-заглушка 4:5, снимок названия и текущая цена, — под ней `@ник` владельца,
 * срок, подпись фазы, чип «Куплено», действия «Купил», «Подарил» (Story 5.7),
 * «Продлить до…», переключатель «Показывать другим гостям, что дарю я» и ⋮ со
 * «Снять бронь».
 *
 * «У @ника» — ссылка на `/u/{ник}` (CLE-129, T4.4; `DESIGN.md` → ReservationCard),
 * поэтому строка владельца живёт в `footer`, соседом кнопки карточки: ссылка
 * внутри ссылки карточки была бы вложенным интерактивом и недоступной с Tab.
 *
 * Цена — текущая цена желания (D-64.7): у недоступного желания (`canOpenGift =
 * false`) её нет, как и ссылки на деталь. Теги, описание и остальные желания в
 * карточку не попадают: набор полей задан `reservationCardSchema` (A-14, AD-7).
 *
 * Основная зона — ссылка на деталь только при `canOpenGift`: после unfriend,
 * Block или сужения видимости сервер отвечает `false`, и тогда карточка не
 * нажимается и не подсвечивается на hover, а действия остаются на месте.
 * Действия живут в `footer` карточки желания — соседом её кнопки, поэтому ни одно
 * действие не вложено в другое.
 *
 * Компонент ничего не запрашивает: `busy` и сами действия принадлежат экрану,
 * поэтому одна карточка не может отправить два запроса.
 */
export function ReservationCard({
  card,
  busy,
  timeZone = "UTC",
  onOpenGift,
  onMenu,
  onExtend,
  onGiven,
  onBoughtChange,
  onVisibilityChange,
  menuRef,
  menuExpanded,
  extendRef,
  width,
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
  // `GIVEN` and a passed deadline offer no extension (D-12, CLE-124/S9b-3): the
  // server refuses it with `RESERVATION_DUE_PASSED`, so the button is not drawn.
  const extend = canExtendReservation(card, timeZone) ? onExtend : undefined;
  // The stage already reads «Подарено», so «Подарил» is not repeated there.
  const given = card.phase === "GIVEN" ? undefined : onGiven;
  // D-64.7: current price, none while the wish is unreachable or has no price.
  const price =
    card.canOpenGift && card.priceAmount !== null && card.priceCurrency !== null
      ? formatPrice(card.priceAmount, card.priceCurrency, locale)
      : null;
  const owner = t("owner", { nick: card.ownerNick });
  const phase = active ? tPhase("ACTIVE", { date: due }) : t("due", { date: due });
  const pressLabel = joinCardName([
    card.titleSnapshot,
    price,
    owner,
    active ? tPhase("ACTIVE", { date: due }) : `${phase}, ${tPhase(card.phase)}`,
  ]);

  // CLE-129, T4.4: «у @ника» — ссылка на профиль владельца. Она стоит в `footer`,
  // соседом кнопки карточки: внутри ссылки карточки была бы ссылка в ссылке.
  const ownerLine = (
    <XStack
      gap="$1"
      alignItems="center"
      flexWrap="wrap"
      testID={testID ? `${testID}-owner` : undefined}
    >
      <Text kind="caption" tone="muted">
        {t("ownerPrefix")}
      </Text>
      <NavLink href={`/u/${encodeURIComponent(card.ownerNick)}`}>
        {`@${card.ownerNick}`}
      </NavLink>
    </XStack>
  );

  const menu = onMenu ? (
    <Pressable
      ref={menuRef}
      role="button"
      aria-label={tGift("closed.menuLabel", { title: card.titleSnapshot })}
      aria-haspopup="dialog"
      aria-expanded={menuExpanded}
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
  ) : undefined;

  const footer = (
    <YStack gap="$2">
      {ownerLine}
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
          ref={extendRef as never}
          variant="outline"
          label={t("extend")}
          onPress={extend}
          disabled={busy}
          testID={testID ? `${testID}-extend` : undefined}
        />
      ) : null}
      {given ? (
        <Button
          variant="secondary"
          label={t("given")}
          onPress={given}
          disabled={busy}
          testID={testID ? `${testID}-given` : undefined}
        />
      ) : null}
      <ReservationVisibility
        values={{
          holderVisibleToOthers: card.holderVisibleToOthers,
        }}
        busy={busy}
        onChange={onVisibilityChange}
        testID={testID ? `${testID}-visibility` : undefined}
      />
    </YStack>
  );

  return (
    <WishCard
      testID={testID}
      width={width}
      title={card.titleSnapshot}
      price={price}
      status={
        active ? null : (
          <Text kind="caption" tone="muted">
            {tPhase(card.phase)}
          </Text>
        )
      }
      reservation={phase}
      onPress={open}
      pressLabel={open ? pressLabel : undefined}
      menu={menu}
      footer={footer}
    />
  );
}

ReservationCard.displayName = "ReservationCard";
