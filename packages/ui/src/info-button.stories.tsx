import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import { InfoButton } from "./info-button";
import { Text } from "./text";

/**
 * `InfoButton` is an icon-only «what does this link show?» control. On the web
 * Tamagui's `Tooltip` opens on hover, on keyboard focus and on a tap: hover the
 * icon or press Tab to open it, or use the press story below.
 */
const meta = {
  title: "UI/InfoButton",
  component: InfoButton,
  args: {
    label: "Что видно по ссылке",
    explanation: "Ссылку увидят все, у кого она есть: и друзья, и те, кому вы её отправили.",
    closeLabel: "Закрыть",
  },
} satisfies Meta<typeof InfoButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The trigger next to the phrase it explains. */
export const WithExplanation: Story = {
  render: function WithExplanationStory(args) {
    return (
      <XStack gap="$2" alignItems="center" width={320}>
        <Text kind="label">Ссылка открыта всем</Text>
        <InfoButton {...args} />
      </XStack>
    );
  },
};

/** The tooltip opened by a real press on the trigger. */
function pressInfoButton({ canvasElement }: { canvasElement: HTMLElement }) {
  const trigger = canvasElement.querySelector<HTMLElement>("[aria-label='Что видно по ссылке']");
  trigger?.click();
}

export const OpenedByPress: Story = {
  render: function OpenedByPressStory(args) {
    return (
      <XStack gap="$2" alignItems="center" width={320}>
        <Text kind="label">Ссылка открыта всем</Text>
        <InfoButton {...args} />
      </XStack>
    );
  },
  play: pressInfoButton,
};

/** A long explanation at 360 px: the tooltip is capped at 320 px and wraps. */
export const LongExplanationNarrow: Story = {
  args: {
    explanation:
      "Желание видно только друзьям: его не найдут в поиске и не увидят те, кто не входит в ваш круг друзей.",
  },
  globals: { viewport: { value: "w360" } },
};
