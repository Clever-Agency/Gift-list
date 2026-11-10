import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { YStack } from "@tamagui/stacks";
import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * `Pressable` is the pressable surface of custom controls (cards, chips, radio
 * rows). Enter and Space run the press in the browser; hover, press and the
 * `:focus-visible` ring are CSS states — hover it, hold it, press Tab; a mouse
 * click leaves no ring, while a phone paints the same `$ring` on `focus`, the
 * state an external keyboard gives (W12.9). A disabled
 * surface keeps its 40% dim and does not react to a press at all (`DESIGN.md` →
 * Состояния кнопок и нажимаемых поверхностей, DECISION 2026-11-10).
 */
const meta = {
  title: "UI/Pressable",
  component: Pressable,
} satisfies Meta<typeof Pressable>;

export default meta;

type Story = StoryObj<typeof meta>;

type SampleProps = {
  label: string;
  disabled?: boolean;
  role?: "button" | "radio" | "checkbox";
  checked?: boolean;
};

function PressableSample({ label, disabled, role = "button", checked }: SampleProps) {
  return (
    <Pressable
      role={role}
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      minHeight="$touch-target"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderWidth={1}
      borderColor="$border-strong"
      borderRadius="$md"
      backgroundColor="$surface"
    >
      <Text kind="label">{label}</Text>
    </Pressable>
  );
}

PressableSample.displayName = "PressableSample";

/** `button`: a surface with the role of a button and the pointer and ring that go with it. */
export const ButtonRole: Story = {
  render: function ButtonRoleStory() {
    return <PressableSample label="Открыть желание" />;
  },
};

/** The press really runs: the counter changes on click, Enter and Space. */
function CountingPressableStory() {
  const [count, setCount] = useState(0);

  function handlePress() {
    setCount(function increment(current) {
      return current + 1;
    });
  }

  return (
    <YStack gap="$2" alignItems="center">
      <Pressable
        role="button"
        aria-label="Нажимаемая карточка"
        onPress={handlePress}
        padding="$3"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$lg"
        backgroundColor="$surface"
        width={280}
      >
        <Text kind="body-strong">Нажимаемая карточка</Text>
        <Text kind="caption" tone="muted">
          Нажатий: {count}
        </Text>
      </Pressable>
    </YStack>
  );
}

CountingPressableStory.displayName = "CountingPressableStory";

export const PressRunsAction: Story = {
  render: CountingPressableStory,
};

/** Disabled keeps its place in the focus order, is announced with `aria-disabled` and does not dim on press: hold it. */
export const Disabled: Story = {
  render: function DisabledStory() {
    return <PressableSample label="Недоступно" disabled />;
  },
};

/** A radio row is the same surface with another role; the app sets `aria-checked`. */
export const RadioRole: Story = {
  render: function RadioRoleStory() {
    return <PressableSample role="radio" label="Показывать друзьям" checked />;
  },
};

/** Long Russian copy inside a narrow surface: the label wraps, nothing is clipped. */
export const LongLabelNarrow: Story = {
  render: function LongLabelNarrowStory() {
    return (
      <YStack width={328}>
        <PressableSample label="Открыть список желаний, которые ждут вашего подтверждения" />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
