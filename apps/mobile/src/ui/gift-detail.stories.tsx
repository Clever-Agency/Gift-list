import type { Meta, StoryObj } from "@storybook/react";
import type { GiftCard } from "@gift-list/contracts";
import { Button, Text, XStack } from "@gift-list/ui";
import { GiftDetail } from "./gift-detail";

/**
 * Страница желания `/gifts/{id}` (D-63): название, описание, цена, ссылка на
 * магазин, статус и теги — одни поля для владельца и гостя. Только владелец
 * видит «Кто видит»; бронь и имя держателя приходят блоками от экрана гостя и
 * владельцу не показываются (AD-15, D-49). Фото в контракте желания пока нет.
 */
const meta = {
  title: "App/GiftDetail",
  component: GiftDetail,
  tags: ["autodocs"],
  args: { gift: sample(), viewer: "guest" },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof GiftDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

function sample(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "gift-1",
    title: "Плед из шерсти мериноса",
    description:
      "Тёплый, 200 × 140, цвет — овсяный. Можно б/у в хорошем состоянии, без пятен.",
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: "https://shop.example/pled",
    visibility: "FRIENDS",
    quantity: "SINGLE",
    expiresOn: "2026-12-31",
    archivedAt: null,
    tags: [
      { catalogId: "home", label: "Дом" },
      { catalogId: "cozy", label: "Уют" },
    ],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

function noop() {}

/** Держатель: своя бронь, «Куплю сам» не показывается, есть «Снять бронь». */
export const Holder: Story = {
  args: {
    viewer: "guest",
    gift: sample({
      status: "RESERVED",
      reservedBy: { id: "u2", nick: "daria", displayName: "Дарья" },
      reservation: {
        dueAt: "2026-12-10",
        phase: "ACTIVE",
        bought: false,
        holderVisibleToOwner: false,
        holderVisibleToOthers: true,
      },
    }),
    actions: <Button label="Снять бронь" variant="secondary" onPress={noop} />,
    children: (
      <Text kind="label" tone="reserved">
        Вы берёте · до 10.12.2026
      </Text>
    ),
  },
};

/** Владелец: видимость текстом и «Изменить»; ни брони, ни «Куплю сам» (D-49). */
export const Owner: Story = {
  args: {
    viewer: "owner",
    actions: <Button label="Изменить" variant="secondary" onPress={noop} />,
  },
};

/** Гость открытого желания: главная кнопка «Куплю сам». */
export const Guest: Story = {
  tags: ["!dev"],
  args: {
    viewer: "guest",
    actions: <Button label="Куплю сам" variant="reserve" onPress={noop} />,
  },
};

/** Пустое желание: нет описания, цены, ссылки и тегов — строки не рисуются. */
export const WithoutExtras: Story = {
  tags: ["!dev"],
  args: {
    viewer: "owner",
    gift: sample({
      description: null,
      priceAmount: null,
      priceCurrency: null,
      linkUrl: null,
      tags: [],
    }),
    actions: <Button label="Изменить" variant="secondary" onPress={noop} />,
  },
};

/** Полученное желание: статус «Получен», у владельца по-прежнему только «Изменить». */
export const Received: Story = {
  tags: ["!dev"],
  args: {
    viewer: "owner",
    gift: sample({ status: "CLOSED" }),
    actions: <Button label="Изменить" variant="secondary" onPress={noop} />,
  },
};

/** Длинная кириллица на 360 px: заголовок и ссылка переносятся, ничего не обрезается. */
export const LongCopyNarrow: Story = {
  tags: ["!dev"],
  args: {
    viewer: "guest",
    gift: sample({
      title: "Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров",
      description:
        "Очень длинное описание на русском языке, чтобы проверить переносы и то, что широкая кириллица не выходит за поля на узком экране телефона.",
      linkUrl: "https://shop.example/pled-with-a-very-long-address-for-the-narrow-screen",
    }),
    actions: (
      <XStack gap="$2" flexWrap="wrap">
        <Button label="Куплю сам" variant="reserve" onPress={noop} />
      </XStack>
    ),
  },
};
