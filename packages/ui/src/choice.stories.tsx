import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { useEffect, useState } from "react";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { Choice, ChoiceList, type ChoiceProps } from "./choice";

const CHOICE_VARIANTS = ["row", "chip"] as const satisfies readonly ChoiceProps["variant"][];

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * One option of a `ChoiceList` (`role="radio"`, `aria-checked`): a row with the
 * dot, the label and a hint line, or a compact chip. The sandbox really selects,
 * so the dot and the `aria-checked` state are live.
 */
const meta = {
  title: "UI/Choice",
  component: Choice,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
One option of a \`ChoiceList\` (\`DESIGN.md\` → Choice): a \`row\` with the radio dot, the label and an optional hint line, or a compact \`chip\` for a short value such as a currency code. The surface is the shared \`Pressable\`, so Enter and Space run the press in the browser.

What is not a prop:

- The group is \`ChoiceList\`: it owns the \`radiogroup\` role, the heading, the group error and the description. A \`Choice\` on its own only draws one option.
- \`hint\` is the second line of a row and its accessible description; a chip has no second line, so the hint is ignored there.
- A disabled option dims to 40%, keeps its place in the focus order and is announced with \`aria-disabled\`.
- The selected row takes the \`muted\` fill and the \`primary\` frame; the selected chip takes the \`primary\` fill and \`inverse\` text. The dot and the text weight carry the state too, not only the colour.
- Hover, press and focus are CSS states, not props: hover an option, hold it, press Tab.
        `.trim(),
      },
    },
  },
  argTypes: {
    variant: propDoc({
      description:
        "`row` — the radio row with the dot, the label and the hint line. `chip` — the compact option, e.g. «BYN».",
      type: formatUnionType(CHOICE_VARIANTS),
      options: CHOICE_VARIANTS,
      required: true,
      defaultValue: "row",
    }),
    label: propDoc({
      description: "The visible text and the accessible name of the radio.",
      type: "string",
      required: true,
      control: "text",
    }),
    hint: propDoc({
      description:
        "The second line of a `row`, also its accessible description. A `chip` has no second line, so the hint is ignored there.",
      type: "string",
      control: "text",
    }),
    selected: propDoc({
      description:
        "The current option: a `muted` fill with the `primary` frame and a filled dot for a row; a `primary` fill with `inverse` text for a chip. The sandbox keeps it locally, so a press really moves the selection.",
      type: "boolean",
      required: true,
      defaultValue: "false",
    }),
    disabled: propDoc({
      description:
        "Shows the stored value without letting it change; the option dims to 40% and keeps its place in the focus order.",
      type: "boolean",
      defaultValue: "false",
    }),
    onPress: propDoc({
      description:
        "Selects the option. Not a control: the sandbox toggles the local `selected` state itself.",
      type: "() => void",
      required: true,
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    variant: "row",
    label: "Показывать друзьям",
    hint: "Видно всем в списке друзей",
    selected: true,
    disabled: false,
    onPress: noop,
    testID: "choice",
  },
} satisfies Meta<typeof Choice>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The option in its own 360 px column, as a form draws a list. */
function ChoicePreview(args: ChoiceProps) {
  return (
    <YStack width={360} maxWidth="100%">
      <Choice {...args} />
    </YStack>
  );
}

ChoicePreview.displayName = "ChoicePreview";

/**
 * The sandbox: press the option — the selection and `aria-checked` really flip —
 * and turn `variant`, `label`, `hint` and `disabled` in the panel.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    const [selected, setSelected] = useState(args.selected);

    useEffect(
      function syncSelectedFromControls() {
        setSelected(args.selected);
      },
      [args.selected],
    );

    function handlePress() {
      setSelected(function toggle(current) {
        return !current;
      });
    }

    return (
      <ChoicePreview
        {...args}
        selected={selected}
        onPress={handlePress}
      />
    );
  },
};

/** The group error is painted around the list, linked and read with each option. */
function ChoiceListWithErrorStory() {
  return (
    <ChoiceList
      label="Валюта подарка"
      heading="Валюта"
      variant="row"
      error="Выберите валюту: без неё нельзя сохранить желание"
    >
      <Choice variant="row" label="BYN — белорусский рубль" selected onPress={noop} />
      <Choice variant="row" label="RUB — российский рубль" selected={false} onPress={noop} />
    </ChoiceList>
  );
}

ChoiceListWithErrorStory.displayName = "ChoiceListWithErrorStory";

export const ListWithError: Story = {
  render: function ListWithErrorStory() {
    return (
      <YStack width={360} maxWidth="100%">
        <ChoiceListWithErrorStory />
      </YStack>
    );
  },
};

/** `row`: resting, without a hint line. */
export const RowUnselected: Story = {
  tags: ["!dev"],
  args: { selected: false, label: "Скрыть из поиска", hint: undefined },
  render: function RowUnselectedStory(args) {
    return <ChoicePreview {...args} />;
  },
};

/** A selected row: the `muted` fill, the `primary` frame, the filled dot and a `primary` label. */
export const RowSelected: Story = {
  tags: ["!dev"],
  render: function RowSelectedStory(args) {
    return <ChoicePreview {...args} />;
  },
};

/** A row without the second line: the label alone. */
export const RowWithoutHint: Story = {
  tags: ["!dev"],
  args: { label: "Скрыть из поиска", hint: undefined, selected: false },
  render: function RowWithoutHintStory(args) {
    return <ChoicePreview {...args} />;
  },
};

/** The stored value is shown but cannot change (other states lock the field); it does not dim on press either. */
export const RowDisabled: Story = {
  tags: ["!dev"],
  args: { disabled: true },
  render: function RowDisabledStory(args) {
    return <ChoicePreview {...args} />;
  },
};

/** `chip`: a compact resting option, e.g. a currency code. */
export const ChipUnselected: Story = {
  tags: ["!dev"],
  args: { variant: "chip", label: "BYN", hint: undefined, selected: false },
  render: function ChipUnselectedStory(args) {
    return <ChoicePreview {...args} />;
  },
};

/** A selected chip: the `primary` fill and `inverse` text. */
export const ChipSelected: Story = {
  tags: ["!dev"],
  args: { variant: "chip", label: "BYN", hint: undefined },
  render: function ChipSelectedStory(args) {
    return <ChoicePreview {...args} />;
  },
};

/** A locked chip: the stored value, no press. */
export const ChipDisabled: Story = {
  tags: ["!dev"],
  args: { variant: "chip", label: "BYN", hint: undefined, disabled: true },
  render: function ChipDisabledStory(args) {
    return <ChoicePreview {...args} />;
  },
};

/** A locked group: the description says why, every option is disabled. */
function ChoiceListLockedStory() {
  return (
    <ChoiceList
      label="Валюта подарка"
      heading="Валюта"
      variant="chip"
      description="Валюту нельзя изменить: подарок уже забронирован"
    >
      <Choice variant="chip" label="BYN" selected disabled onPress={noop} />
      <Choice variant="chip" label="RUB" selected={false} disabled onPress={noop} />
      <Choice variant="chip" label="USD" selected={false} disabled onPress={noop} />
    </ChoiceList>
  );
}

ChoiceListLockedStory.displayName = "ChoiceListLockedStory";

export const ListLocked: Story = {
  tags: ["!dev"],
  render: function ListLockedStory() {
    return (
      <YStack width={360} maxWidth="100%">
        <ChoiceListLockedStory />
      </YStack>
    );
  },
};
