import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import { PartnerStoreCard } from "./partner-store-card";

/**
 * The partner store card of v8 (variant C): a store cover, the logo circle on its
 * bottom edge, the name, the category and a quiet promo chip. No text sits on the
 * photo; without a cover the store's monogram stands on a calm tint. The rail
 * (`UI/PartnerStoreRail`) is the only horizontal slider of the design.
 */
const meta = {
  title: "UI/PartnerStoreCard",
  component: PartnerStoreCard,
  args: {
    name: "Северная лавка",
    category: "дом и уют",
    promo: "−15% по промокоду",
    monogram: "СЛ",
    width: 200,
  },
} satisfies Meta<typeof PartnerStoreCard>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

export const Default: Story = {};

/** Without a promo: the card keeps the same height, only one line fewer. */
export const WithoutPromo: Story = {
  args: { promo: null },
};

/** A promotional store with a longer name and category at 360 px. */
export const LongTextNarrow: Story = {
  args: {
    name: "Книжный ковчег на Петроградской стороне",
    category: "книги, канцелярия, настольные игры",
    promo: "−10% новичкам по промокоду ПЕРВАЯКНИГА",
    monogram: "КК",
    width: 160,
  },
  globals: { viewport: { value: "w360" } },
};

/** A pressable store: the whole card is the button, the name is its label. */
export const Pressable: Story = {
  args: {
    onPress: noop,
    pressLabel: "Северная лавка, дом и уют, −15% по промокоду",
  },
};

/** The set the rail slides: one width, one gap, placeholders with monograms. */
export const Rail: Story = {
  render: function RailStory() {
    const stores = [
      { name: "Северная лавка", category: "дом и уют", promo: "−15% по промокоду", monogram: "СЛ" },
      { name: "Пиксель", category: "техника и гаджеты", promo: "кешбэк 7%", monogram: "ПК" },
      { name: "Книжный ковчег", category: "книги", promo: null, monogram: "КК" },
      { name: "Кофейный двор", category: "кофе и чай", promo: "−20% на зёрна", monogram: "КД" },
    ];
    return (
      <XStack gap={14}>
        {stores.map(function store(item) {
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
        })}
      </XStack>
    );
  },
};
