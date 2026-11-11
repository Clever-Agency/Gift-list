import type { Meta, StoryObj } from "@storybook/react";
import { ScrollView } from "./scroll";
import { Text } from "./text";
import { View } from "./layout";

/**
 * `ScrollView` is the package's scroll area: a `div` with `overflow` on the web,
 * the native ScrollView on the phone. A page has one such area — `PageScroll`.
 */
const meta = {
  title: "UI/ScrollView",
  component: ScrollView,
} satisfies Meta<typeof ScrollView>;

export default meta;

type Story = StoryObj<typeof meta>;

const WISHES = [
  "Плед из шерсти мериноса",
  "Настольная лампа с тёплым светом",
  "Набор для каллиграфии",
  "Керамическая кружка ручной работы",
  "Книга «Мастер и Маргарита» в подарочном издании",
  "Тёплые носки из верблюжьей шерсти",
  "Подписка на онлайн-курс по фотографии",
  "Деревянная разделочная доска",
  "Термос на 750 мл",
  "Путешествие на выходные к озеру",
  "Настольная игра для компании",
  "Кофемолка с ручным приводом",
];

/** A bounded vertical area: the content scrolls, the frame stays put. */
export const Vertical: Story = {
  render: function VerticalScrollStory() {
    return (
      <ScrollView
        width={320}
        height={200}
        borderWidth={1}
        borderColor="$border"
        borderRadius="$md"
        backgroundColor="$surface"
      >
        {WISHES.map(function renderWish(wish) {
          return (
            <View key={wish} padding="$3" borderBottomWidth={1} borderColor="$border">
              <Text kind="label">{wish}</Text>
            </View>
          );
        })}
      </ScrollView>
    );
  },
};

/** `horizontal`: the same area along the other axis, e.g. a chip row that does not wrap. */
export const Horizontal: Story = {
  render: function HorizontalScrollStory() {
    return (
      <ScrollView
        horizontal
        width={320}
        height={64}
        showsHorizontalScrollIndicator
        borderWidth={1}
        borderColor="$border"
        borderRadius="$md"
        backgroundColor="$surface"
      >
        <Text padding="$3" kind="label">
          Плед из шерсти мериноса · Настольная лампа · Набор для каллиграфии · Термос
        </Text>
      </ScrollView>
    );
  },
};
