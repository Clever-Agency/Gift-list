import type { Meta, StoryObj } from "@storybook/react";
import { PageScroll } from "./page-scroll";
import { Text } from "./text";
import { View } from "./layout";

/**
 * `PageScroll` is the single scroll area of a page: the header, the content and
 * the footer scroll together. On the phone it also publishes itself as the area
 * form errors scroll within (UI5). It needs a bounded parent — the stories give
 * it a 360 × 400 frame that stands for the window.
 */
const meta = {
  title: "UI/PageScroll",
  component: PageScroll,
  args: {
    children: null,
  },
} satisfies Meta<typeof PageScroll>;

export default meta;

type Story = StoryObj<typeof meta>;

const WISHES = [
  "Плед из шерсти мериноса",
  "Настольная лампа с тёплым светом",
  "Набор для каллиграфии",
  "Керамическая кружка ручной работы",
  "Термос на 750 мл",
  "Настольная игра для компании",
  "Кофемолка с ручным приводом",
  "Деревянная разделочная доска",
];

/** A long page in a short window: the content scrolls, the page frame does not. */
export const LongPage: Story = {
  render: function LongPageStory() {
    return (
      <View width={360} height={420} backgroundColor="$background">
        <PageScroll testID="page-scroll-story">
          <View padding="$3" gap="$2">
            <Text kind="display-sm">Мой вишлист</Text>
            {WISHES.map(function renderWish(wish) {
              return (
                <View
                  key={wish}
                  padding="$3"
                  backgroundColor="$surface"
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$lg"
                >
                  <Text kind="body-strong">{wish}</Text>
                </View>
              );
            })}
            <Text kind="caption" tone="muted" textAlign="center">
              Конец вишлиста
            </Text>
          </View>
        </PageScroll>
      </View>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A form keeps the keyboard open while the user taps a control. */
export const FormKeepsKeyboard: Story = {
  render: function FormKeepsKeyboardStory() {
    return (
      <View width={360} height={320} backgroundColor="$background">
        <PageScroll keyboardShouldPersistTaps="handled">
          <View padding="$3" gap="$2">
            <Text kind="heading">Новое желание</Text>
            <Text>
              Форма с полями: при касании чипа или кнопки клавиатура остаётся открытой
              («handled»), потому что control сам забирает нажатие.
            </Text>
          </View>
        </PageScroll>
      </View>
    );
  },
  globals: { viewport: { value: "w360" } },
};
