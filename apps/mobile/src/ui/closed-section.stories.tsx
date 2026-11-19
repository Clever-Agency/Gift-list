import type { Meta, StoryObj } from "@storybook/react";
import type { GiftCard } from "@gift-list/contracts";
import { ClosedSection } from "./closed-section";
import { WishCard } from "./gift-card";

/**
 * Свёрнутая секция закрытых желаний (Story 5.3, `DESIGN.md` → Мелкие элементы):
 * «Получено (N)» у владельца, «Уже подарено» у зрителей, «Архив (N)» — один
 * компонент. Заголовок — кнопка с шевроном и `aria-expanded`, карточки лежат в
 * сетке-списке. Свёрнутая секция карточек в дереве не держит.
 */
const meta = {
  title: "App/ClosedSection",
  component: ClosedSection,
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof ClosedSection>;

export default meta;

type Story = StoryObj<typeof meta>;

function sample(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "gift-1",
    title: "Плед из шерсти мериноса",
    description: null,
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [{ catalogId: "home", label: "Дом" }],
    status: "CLOSED",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

function cards() {
  return (
    <>
      <WishCard gift={sample({ id: "gift-1" })} width={156} closed />
      <WishCard
        gift={sample({ id: "gift-2", title: "Свитер", priceAmount: 1050, priceCurrency: "BYN" })}
        width={156}
        closed
      />
    </>
  );
}

/** Свёрнутая «Получено (2)» — состояние по умолчанию. */
export const Collapsed: Story = {
  args: {
    label: "Получено (2)",
    expanded: false,
    onToggle: function toggle() {},
    children: cards(),
  },
};

/** Раскрытая «Получено (2)»: карточки как у закрытых — текст `muted`, pill «Получен». */
export const Expanded: Story = {
  args: {
    label: "Получено (2)",
    expanded: true,
    onToggle: function toggle() {},
    children: cards(),
  },
};

/** У зрителя та же секция называется «Уже подарено» и действий не имеет. */
export const Viewer: Story = {
  args: {
    label: "Уже подарено",
    expanded: true,
    onToggle: function toggle() {},
    children: cards(),
  },
};

/** Длинная подпись счёта на 360 px: заголовок переносится, шеврон остаётся. */
export const NarrowLongLabel: Story = {
  args: {
    label: "Получено (128)",
    expanded: false,
    onToggle: function toggle() {},
  },
  globals: { viewport: { value: "w360" } },
};
