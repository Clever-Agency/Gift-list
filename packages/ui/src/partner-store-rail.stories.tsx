import type { Meta, StoryObj } from "@storybook/react";
import { PartnerStoreCard } from "./partner-store-card";
import { PartnerStoreRail } from "./partner-store-rail";

/**
 * The v8 rail of the search screen: a heading row with the ad marking («Партнёры» +
 * info sign) and «Все», then a one-row horizontal slider of store cards. This is the
 * only horizontal slider pattern of the design; wishes themselves are a grid.
 */
const meta = {
  title: "UI/PartnerStoreRail",
  component: PartnerStoreRail,
  args: {
    title: "Магазины-партнёры",
    label: "Партнёры",
    labelInfo: "WishMoon получает вознаграждение за покупки по этим ссылкам",
    allLabel: "Все",
    children: null,
  },
} satisfies Meta<typeof PartnerStoreRail>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

const STORES = [
  { name: "Северная лавка", category: "дом и уют", promo: "−15% по промокоду", monogram: "СЛ" },
  { name: "Пиксель", category: "техника и гаджеты", promo: "кешбэк 7%", monogram: "ПК" },
  { name: "Книжный ковчег", category: "книги", promo: "−10% новичкам", monogram: "КК" },
  { name: "Кофейный двор", category: "кофе и чай", promo: "−20% на зёрна", monogram: "КД" },
];

function stores(): React.ReactNode {
  return STORES.map(function store(item) {
    return (
      <PartnerStoreCard
        key={item.name}
        name={item.name}
        category={item.category}
        promo={item.promo}
        monogram={item.monogram}
        width={200}
      />
    );
  });
}

export const Default: Story = {
  render: function DefaultStory(args) {
    return <PartnerStoreRail {...args}>{stores()}</PartnerStoreRail>;
  },
};

/** The marking opens its explanation; «Все» opens the screen of every store. */
export const WithActions: Story = {
  args: { onLabelPress: noop, onAllPress: noop },
  render: function WithActionsStory(args) {
    return <PartnerStoreRail {...args}>{stores()}</PartnerStoreRail>;
  },
};

/** Without the marking and «Все»: the same rail, just the heading and the cards. */
export const TitleOnly: Story = {
  args: { label: undefined, labelInfo: undefined, allLabel: undefined },
  render: function TitleOnlyStory(args) {
    return <PartnerStoreRail {...args}>{stores()}</PartnerStoreRail>;
  },
};

/** At 360 px the rail keeps the page gutter and the next card still peeks in. */
export const Narrow: Story = {
  args: { onLabelPress: noop, onAllPress: noop },
  render: function NarrowStory(args) {
    return <PartnerStoreRail {...args}>{stores()}</PartnerStoreRail>;
  },
  globals: { viewport: { value: "w360" } },
};
