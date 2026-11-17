import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { Spinner } from "./spinner";
import { Text } from "./text";
import { colors } from "./tokens";

/**
 * The busy indicator (`DESIGN.md` → Состояния кнопок → busy): the Lucide
 * `LoaderCircle` arc, 16 px, in the colour of the text, one linear turn in
 * 800 ms. It is decorative — the waiting state is announced by the control that
 * owns it (`aria-busy` on a button), not by the drawing.
 *
 * `Button` places it itself in the `busy` state; on its own the spinner is useful
 * only inside a fix that has to draw the same indicator. The arc is static with
 * «уменьшить движение»: Storybook has no addon that emulates the media query, so
 * turn the OS setting on or pick `prefers-reduced-motion: reduce` in the
 * browser's DevTools → Rendering → Emulate CSS media feature. The `Button`
 * stories show the same state in place.
 */
const meta = {
  title: "UI/Spinner",
  component: Spinner,
  args: {
    size: 16,
  },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 16 px in the colour of the surrounding text (`currentColor`). */
export const Default: Story = {
  render: function DefaultSpinnerStory(args) {
    return (
      <XStack gap="$2" alignItems="center">
        <Spinner {...args} />
        <Text kind="body">Сохраняем…</Text>
      </XStack>
    );
  },
};

/**
 * What a busy `primary` button draws: the spinner takes the label colour of the
 * variant (`primary-foreground`) through the `color` prop, as `Button` passes it.
 */
export const OnPrimary: Story = {
  render: function OnPrimarySpinnerStory(args) {
    return (
      <XStack
        gap="$2"
        alignItems="center"
        justifyContent="center"
        paddingHorizontal="$card-padding"
        minHeight="$control-height"
        borderRadius="$md"
        backgroundColor="$primary"
      >
        <Spinner {...args} color={colors["primary-foreground"]} />
        <Text kind="button" tone="inverse">
          Сохраняем…
        </Text>
      </XStack>
    );
  },
};

/** The same drawing at the sizes it is compared with: 16 px next to 24 px. */
export const Sizes: Story = {
  render: function SizesSpinnerStory() {
    return (
      <YStack gap="$3">
        <XStack gap="$3" alignItems="center">
          <Spinner size={16} />
          <Text kind="caption">16 px — busy-кнопка</Text>
        </XStack>
        <XStack gap="$3" alignItems="center">
          <Spinner size={24} />
          <Text kind="caption">24 px — крупная зона</Text>
        </XStack>
      </YStack>
    );
  },
};
