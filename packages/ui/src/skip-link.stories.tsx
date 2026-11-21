import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { SkipLink } from "./skip-link";
import { Text } from "./text";

/**
 * The first stop of the Tab order (`DESIGN.md` → Порядок Tab): a link to
 * `main#main-content` that stays invisible until it takes focus. A phone draws
 * nothing. The story focuses the link for you — otherwise there is nothing to
 * see; in a real page press Tab once.
 */
const meta = {
  title: "UI/SkipLink",
  component: SkipLink,
  args: { label: "Перейти к содержимому" },
} satisfies Meta<typeof SkipLink>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Press Tab: the first stop is the skip link, then the page content. */
export const FocusedByTab: Story = {
  render: function FocusedByTabStory(args) {
    return (
      <YStack height={180} padding="$4" gap="$2" backgroundColor="$background">
        <SkipLink {...args} testID="skip" />
        <Text kind="body-strong">Содержимое страницы</Text>
        <Text kind="body-sm" tone="muted">
          Ссылка «Перейти к содержимому» появляется, когда на неё попадает фокус: нажмите Tab.
        </Text>
      </YStack>
    );
  },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLAnchorElement>("a")?.focus();
  },
};

/** Without focus the link stays invisible: the page looks as if it were not there. */
export const Resting: Story = {
  render: function RestingStory(args) {
    return (
      <YStack height={120} padding="$4" gap="$2" backgroundColor="$background">
        <SkipLink {...args} />
        <Text kind="body-sm" tone="muted">
          Без фокуса ссылки не видно — она ждёт первого Tab.
        </Text>
      </YStack>
    );
  },
};
