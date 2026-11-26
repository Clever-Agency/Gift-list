import type { Meta, StoryObj } from "@storybook/react";
import type { ReservationCard as ReservationCardData } from "@gift-list/contracts";
import { YStack } from "@gift-list/ui";
import { ReservationCard, type ReservationCardProps } from "./reservation-card";

/**
 * Карточка брони держателя (Story 5.5, D-56, `DESIGN.md` → ReservationCard): та же
 * v8-карточка желания — фото-заглушка 4:5, снимок названия и цена, — под ней
 * «у @ник», срок «до DD.MM», подпись фазы из «Подписи брони», чип «Куплено»,
 * «Купил», «Подарил» (Story 5.7), «Продлить до…» и переключатель «Показывать
 * другим гостям, что дарю я». Ссылка на деталь и цена — только при `canOpenGift`;
 * в `GIVEN` и после Срока продления нет (CLE-124/S9b-3).
 */
const meta = {
  title: "App/ReservationCard",
  component: ReservationCard,
  tags: ["autodocs"],
  // Карточка стоит в колонке страницы: кадр каталога не должен сужать её сам.
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof ReservationCard>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

function sample(overrides: Partial<ReservationCardData> = {}): ReservationCardData {
  return {
    giftId: "gift-1",
    titleSnapshot: "Плед из шерсти мериноса",
    status: "RESERVED",
    ownerNick: "anya",
    dueAt: "2026-12-01",
    phase: "ACTIVE",
    bought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    priceAmount: null,
    priceCurrency: null,
    photoUrl: null,
    canOpenGift: true,
    ...overrides,
  };
}

/** The props every story shares; each story changes the card or one state. */
const base = {
  card: sample(),
  timeZone: "Europe/Minsk",
  // Колонка сетки на телефоне 360 px: две карточки и gap.
  width: 164,
  onOpenGift: noop,
  onMenu: noop,
  onExtend: noop,
  onGiven: noop,
  onBoughtChange: noop,
  onVisibilityChange: noop,
} satisfies ReservationCardProps;

/** `ACTIVE`: «Вы берёте · до DD.MM» уже содержит срок, отдельной строки нет. */
export const Active: Story = {
  args: base,
};

/** `AWAITING_GIVER`: «Срок истёк», «Подарил» и «Снять бронь» остаются, продления нет. */
export const AwaitingGiver: Story = {
  tags: ["!dev"],
  args: { ...base, card: sample({ phase: "AWAITING_GIVER" }) },
};

/** `AWAITING_OWNER`: тоже «Срок истёк» — владельца больше ни о чём не спрашивают. */
export const AwaitingOwner: Story = {
  args: { ...base, card: sample({ phase: "AWAITING_OWNER" }) },
};

/** `GIVEN`: «Подарено»; «Подарил» и «Продлить до…» не предлагаются (Story 5.7). */
export const Given: Story = {
  tags: ["!dev"],
  args: { ...base, card: sample({ phase: "GIVEN" }) },
};

/** Флаг «Купил»: чип «Куплено» и включённый переключатель. */
export const Bought: Story = {
  tags: ["!dev"],
  args: { ...base, card: sample({ bought: true }) },
};

/** Переключатель «Показывать другим гостям, что дарю я» выключен. */
export const VisibilityOff: Story = {
  tags: ["!dev"],
  args: { ...base, card: sample({ holderVisibleToOthers: false }) },
};

/** `canOpenGift = false`: карточки-кнопки и цены нет, действия на месте (A-14, D-64.7). */
export const WithoutLink: Story = {
  tags: ["!dev"],
  args: { ...base, card: sample({ canOpenGift: false }) },
};

/** Цена — текущая цена желания, тем же форматтером, что у карточки желания. */
export const WithPrice: Story = {
  tags: ["!dev"],
  args: { ...base, card: sample({ priceAmount: 250000, priceCurrency: "RUB" }) },
};

/** Запрос карточки в полёте: все действия заняты. */
export const Busy: Story = {
  tags: ["!dev"],
  args: { ...base, busy: true },
};

/** Длинная кириллица на 360 px: название в две строки, кнопки не переполняются. */
export const LongCyrillicNarrow: Story = {
  tags: ["!dev"],
  args: {
    ...base,
    card: sample({ titleSnapshot: "Сертификат на мастер-класс по керамике для двоих" }),
  },
};

/** Широкая колонка (medium): карточка тянется по колонке страницы. */
export const Medium: Story = {
  tags: ["!dev"],
  args: { ...base, width: 320 },
  globals: { viewport: { value: "w768" } },
  render: function MediumStory() {
    return (
      <YStack padding="$page-gutter" width="100%" maxWidth={640}>
        <ReservationCard {...base} width={320} />
      </YStack>
    );
  },
};
