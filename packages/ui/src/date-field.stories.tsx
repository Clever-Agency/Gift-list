import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { useEffect, useState, type ComponentType } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { DateField, type DateFieldProps } from "./date-field";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/** The ready-made message the «есть ошибка» handle stands in. */
const DATE_ERROR = "Дата не может быть в прошлом";

/**
 * The field props plus the «есть ошибка» handle: the error message is a fixture,
 * so the panel turns a switch instead of typing a made-up validation string. The
 * cast on `component` below is what lets the Docs controls and the story args see
 * the handle; the component itself stays unchanged.
 */
type DateFieldCatalogProps = DateFieldProps & { hasError: boolean };

/**
 * The date field (`DESIGN.md` → Поле даты): in the browser a real
 * `<input type="date">`; on a phone a button that opens the system picker. The
 * sandbox is live: a picked day sticks and «Сбросить» really clears it.
 */
const meta = {
  title: "UI/DateField",
  component: DateField as ComponentType<DateFieldCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The date field of a wish (\`DESIGN.md\` → Поле даты). In the browser it is a real \`<input type="date">\` — the picker, the keyboard and the locale are the browser's own; on a phone it is a button that opens the system picker (\`date-field.native.tsx\`). The package is controlled: \`value\` and \`onChange\` belong to the caller.

What is not a prop:

- \`value\` is \`YYYY-MM-DD\`, or \`""\` when no day is chosen; the clear button appears only with a day set.
- \`min\` is an inclusive lower bound the browser enforces in its own picker; the server checks the owner's time zone for the real rule.
- \`placeholder\`, \`displayValue\` and \`doneLabel\` are the phone half's copy (the empty button, the chosen day, the sheet's done action); the browser input has its own empty state, so the catalog does not turn them.
- The error is one string: rendered once under the field, announced as an alert and linked with \`aria-describedby\` and \`aria-invalid\`. The «есть ошибка» handle stands a ready-made message in.
- Hover and focus are CSS states, not props: hover the field, open the picker or press Tab.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description: "The visible label, linked to the input; also the accessible name on the web.",
      type: "string",
      required: true,
      control: "text",
    }),
    value: propDoc({
      description:
        "The chosen day as `YYYY-MM-DD`, or `\"\"` when nothing is chosen. The sandbox keeps it locally, so a picked day sticks and the control re-seeds it.",
      type: "string",
      required: true,
      control: "text",
    }),
    onChange: propDoc({
      description:
        "The picked day (`YYYY-MM-DD`) or `\"\"` from «Сбросить»; the caller owns the value.",
      type: "(value: string) => void",
      required: true,
      control: false,
    }),
    min: propDoc({
      description:
        "An inclusive lower bound, `YYYY-MM-DD`: the browser greys earlier days out in its picker. The real rule is checked by the server in the owner's time zone.",
      type: "string",
      control: "text",
    }),
    error: propDoc({
      description:
        "A validation error from the screen: shown in `destructive` under the field, announced with `role=\"alert\"` and linked to the input. An error replaces the hint. The «есть ошибка» handle stands a ready-made message in.",
      type: "string",
      control: false,
    }),
    hint: propDoc({
      description:
        "A permanent line under the field in `muted-foreground`, e.g. what happens after that day. An error replaces it.",
      type: "string",
      control: "text",
    }),
    clearLabel: propDoc({
      description:
        "The visible text and the accessible name of the clear button, e.g. «Сбросить». It exists only while a day is set.",
      type: "string",
      required: true,
      control: "text",
    }),
    placeholder: propDoc({
      description: "Phone only: the text of the empty button before a day is chosen.",
      type: "string",
      control: false,
    }),
    displayValue: propDoc({
      description: "Phone only: the chosen day, already formatted for the button.",
      type: "string",
      control: false,
    }),
    doneLabel: propDoc({
      description: "Phone only: the done action of the iOS picker sheet.",
      type: "string",
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    hasError: {
      name: "есть ошибка",
      description:
        "Ручка каталога: показать готовое сообщение об ошибке вместо подсказки и покрасить рамку в `destructive`.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    label: "Срок желания",
    value: "2026-12-31",
    onChange: noop,
    hint: "После этого дня желание уйдёт в архив",
    clearLabel: "Сбросить",
    testID: "date-field",
    hasError: false,
  },
} satisfies Meta<DateFieldCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: pick a day in the browser's own calendar and press «Сбросить» —
 * both really change the value. `label`, `hint` and `min` are in the panel;
 * «есть ошибка» stands a ready-made message in.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    const [value, setValue] = useState(args.value);

    useEffect(
      function syncValueFromControls() {
        setValue(args.value);
      },
      [args.value],
    );

    return <DateFieldStory {...args} value={value} onChange={setValue} />;
  },
};

/** The error replaces the hint, turns the border red and is read as an alert. */
export const WithError: Story = {
  args: { value: "2026-01-01", hint: undefined, hasError: true },
  render: function WithErrorStory(args) {
    return <DateFieldStory {...args} />;
  },
};

/** No day chosen: the hint under the field, no clear button. */
export const Empty: Story = {
  tags: ["!dev"],
  args: { value: "", hint: undefined },
  render: function EmptyStory(args) {
    return <DateFieldStory {...args} />;
  },
};

/** A day is set: the «Сбросить» button appears next to the input. */
export const WithDate: Story = {
  tags: ["!dev"],
  render: function WithDateStory(args) {
    return <DateFieldStory {...args} />;
  },
};

/** `min` lets the browser grey out earlier days in its picker; try the calendar icon. */
export const WithMin: Story = {
  tags: ["!dev"],
  args: { min: "2026-11-19", value: "" },
  render: function WithMinStory(args) {
    return <DateFieldStory {...args} />;
  },
};

/** Long Cyrillic label, hint and error at 360 px wrap without horizontal scroll. */
export const LongCyrillicNarrow: Story = {
  tags: ["!dev"],
  args: {
    label: "Срок, после которого желание автоматически переедет в архив владельца",
    hint: "Выберите день из календаря или оставьте поле пустым, чтобы желание не истекало",
    error: "Нельзя выбрать день, который уже прошёл в вашем часовом поясе",
    value: "2027-02-28",
  },
  render: function LongCyrillicNarrowStory(args) {
    return <DateFieldStory {...args} width={328} />;
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * The field with the «есть ошибка» handle applied: an explicit `error` string
 * (the long Cyrillic sample) still wins over the ready-made message.
 */
function DateFieldStory({
  hasError,
  error,
  width = 360,
  ...fieldArgs
}: DateFieldCatalogProps & { width?: number }) {
  return (
    <YStack width={width} maxWidth="100%">
      <DateField
        {...fieldArgs}
        error={error ?? (hasError ? DATE_ERROR : undefined)}
      />
    </YStack>
  );
}

DateFieldStory.displayName = "DateFieldStory";
