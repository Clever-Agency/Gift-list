import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { useState, type ComponentType } from "react";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { Pressable, type PressableProps } from "./pressable";
import { Text } from "./text";

const PRESSABLE_ROLES = ["button", "radio", "checkbox"] as const;

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * The pressable props plus the sample label. `Pressable` has no label and no look
 * of its own — a screen draws the contents — so the catalog keeps a plain plate
 * and a text row for the sandbox. The cast on `component` below is what lets the
 * Docs controls and the story args see the handle; the component stays unchanged.
 */
type PressableCatalogProps = PressableProps & { label: string };

/**
 * `Pressable` is the pressable surface of custom controls (cards, chips, radio
 * rows): any role, Enter and Space run the press in the browser. The sandbox
 * counts real presses, so the feedback and the keyboard both work.
 */
const meta = {
  title: "UI/Pressable",
  component: Pressable as ComponentType<PressableCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The pressable surface of custom controls (cards, chips, radio rows). It has no look of its own: the caller passes the children and the style props, so every sample in the catalog draws a plain plate.

What is not a prop:

- A plain button with a label is \`UI/Button\`; \`Pressable\` is for a surface whose role and contents the screen decides.
- Enter and Space run \`onPress\` in the browser; the role is the one the caller passes (\`button\`, \`radio\`, \`checkbox\`…), and \`aria-checked\` belongs to the screen for a radio.
- The press feedback is the \`opacity: 0.9\` the rest of the app gives; hover and the \`$ring\` focus ring are CSS states — hover the plate, hold it, press Tab. A mouse click leaves no ring; a phone paints the same ring on \`focus\` (W12.9).
- A disabled surface dims to 40%, keeps its place in the focus order, is announced with \`aria-disabled\` and does not react to a press at all (\`DESIGN.md\` → Состояния кнопок и нажимаемых поверхностей, DECISION 2026-11-10).
        `.trim(),
      },
    },
  },
  argTypes: {
    label: {
      name: "подпись",
      description:
        "Ручка каталога: текст образца. Он же становится доступным именем поверхности (`aria-label`).",
      control: "text",
      table: {
        category: "Ручки каталога",
        type: { summary: "string" },
        defaultValue: { summary: "Открыть желание" },
      },
    },
    role: propDoc({
      description:
        "The role of the surface. The app uses `button`, `radio` and `checkbox`; another role is passed through as it is. `aria-checked` belongs to the screen for a radio.",
      type: formatUnionType(PRESSABLE_ROLES),
      options: PRESSABLE_ROLES,
      defaultValue: "button",
    }),
    disabled: propDoc({
      description:
        "Announced as disabled (`aria-disabled`), dimmed to 40%, keeps its place in the focus order and ignores presses — unlike a native disabled button.",
      type: "boolean",
      defaultValue: "false",
    }),
    onPress: propDoc({
      description:
        "The press itself: a click, Enter or Space in the browser, a press on a phone. Not a control — the sandbox counts the presses it receives.",
      type: "() => void",
      control: false,
    }),
    children: propDoc({
      description:
        "The contents of the surface. The app draws a card, a chip or a row here; the catalog keeps a plain text plate.",
      type: "ReactNode",
      control: false,
    }),
  },
  args: {
    label: "Открыть желание",
    role: "button",
    disabled: false,
    onPress: noop,
  },
} satisfies Meta<PressableCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The plain plate of the catalog: the surface and its label, nothing else. */
function PressablePreview({ label, role, disabled, children, ...rest }: PressableCatalogProps) {
  return (
    <Pressable
      {...rest}
      role={role}
      disabled={disabled}
      aria-label={label}
      minHeight="$touch-target"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderWidth={1}
      borderColor="$border-strong"
      borderRadius="$md"
      backgroundColor="$surface"
    >
      {children ?? <Text kind="label">{label}</Text>}
    </Pressable>
  );
}

PressablePreview.displayName = "PressablePreview";

/**
 * The sandbox: press the plate (or focus it and press Enter / Space) — the counter
 * grows, so the press really runs. `label`, `role` and `disabled` are in the panel.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    const [count, setCount] = useState(0);

    function handlePress() {
      setCount(function increment(current) {
        return current + 1;
      });
    }

    return (
      <YStack gap="$2" alignItems="flex-start">
        <PressablePreview {...args} onPress={handlePress} />
        <Text kind="caption" tone="muted">
          Нажатий: {count}
        </Text>
      </YStack>
    );
  },
};

/** Disabled keeps its place in the focus order, is announced with `aria-disabled` and does not dim on press: hold it. */
export const Disabled: Story = {
  args: { label: "Недоступно", disabled: true },
  render: function DisabledStory(args) {
    return <PressablePreview {...args} />;
  },
};

/** `button`: a surface with the role of a button and the pointer and ring that go with it. */
export const ButtonRole: Story = {
  tags: ["!dev"],
  render: function ButtonRoleStory(args) {
    return <PressablePreview {...args} />;
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
  tags: ["!dev"],
  render: CountingPressableStory,
};

/** A radio row is the same surface with another role; the app sets `aria-checked`. */
export const RadioRole: Story = {
  tags: ["!dev"],
  render: function RadioRoleStory() {
    return (
      <Pressable
        role="radio"
        aria-label="Показывать друзьям"
        aria-checked
        minHeight="$touch-target"
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderWidth={1}
        borderColor="$border-strong"
        borderRadius="$md"
        backgroundColor="$surface"
      >
        <Text kind="label">Показывать друзьям</Text>
      </Pressable>
    );
  },
};

/** Long Russian copy inside a narrow surface: the label wraps, nothing is clipped. */
export const LongLabelNarrow: Story = {
  tags: ["!dev"],
  render: function LongLabelNarrowStory(args) {
    return (
      <YStack width={328}>
        <PressablePreview
          {...args}
          label="Открыть список желаний, которые ждут вашего подтверждения"
        />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
