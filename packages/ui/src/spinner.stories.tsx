import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { propDoc } from "../../../.storybook/argTypes";
import { Spinner } from "./spinner";
import { Text } from "./text";
import { colors } from "./tokens";

/**
 * The busy indicator (`DESIGN.md` → Состояния кнопок → busy): the Lucide
 * `LoaderCircle` arc, 16 px, in the colour of the text, one linear turn in
 * 800 ms. It is decorative — the waiting state is announced by the control that
 * owns it (`aria-busy` on a button), not by the drawing.
 *
 * The canvas is the sandbox: `size`, `color` and `testID` are controls, and the
 * states below it are ready-made frames for the Docs page.
 */
const meta = {
  title: "UI/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The waiting indicator of a busy control: the Lucide \`LoaderCircle\` arc, one linear turn in 800 ms. \`Button\` places it itself in the \`busy\` state; on its own it is useful only inside a frame that has to draw the same indicator.

What is not a prop:

- The drawing is decorative (\`aria-hidden\`): the wait is announced by the control that owns it (\`aria-busy\` on a button), not by the spinner.
- With «уменьшить движение» the arc does not turn at all: the story is still announced by the same \`aria-busy\`. Storybook has no addon that emulates the media query — turn the OS setting on or pick \`prefers-reduced-motion: reduce\` in DevTools → Rendering → Emulate CSS media feature.
- The phone twin (\`spinner.native.tsx\`) uses a native \`Animated\` loop, because \`react-native-svg\` has no SMIL; the size and the period come from the same modules.
        `.trim(),
      },
    },
  },
  argTypes: {
    size: propDoc({
      description:
        "The edge of the square box in pixels. `DESIGN.md` → busy asks for 16; a large zone uses 24.",
      type: "number",
      defaultValue: "16",
      control: "number",
    }),
    color: propDoc({
      description:
        "The colour of the arc, as a CSS colour. The default `currentColor` follows the text around the spinner; `Button` passes the label token of its variant as a value, because the indicator sits over the button fill rather than inside its text. A phone has no `currentColor`, so the caller always passes the token there.",
      type: "string",
      defaultValue: "currentColor",
      control: "text",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      defaultValue: "spinner",
      control: "text",
    }),
  },
  args: {
    size: 16,
    color: "currentColor",
    testID: "spinner",
  },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: the spinner next to a line of text, so `currentColor` has a text
 * colour to follow. Change `size` and `color` in the panel; `currentColor` is
 * the resting value and is not a broken one.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
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

/** 16 px in the colour of the surrounding text (`currentColor`). */
export const Default: Story = {
  tags: ["!dev"],
  render: function DefaultSpinnerStory(args) {
    return (
      <XStack gap="$2" alignItems="center">
        <Spinner {...args} />
        <Text kind="body">Сохраняем…</Text>
      </XStack>
    );
  },
};

/** The same drawing at the sizes it is compared with: 16 px next to 24 px. */
export const Sizes: Story = {
  tags: ["!dev"],
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
