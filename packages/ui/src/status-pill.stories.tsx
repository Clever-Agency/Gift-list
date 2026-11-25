import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { StatusPill, type StatusPillStatus } from "./status-pill";

const STATUS_PILL_STATUSES = ["open", "reserved", "closed"] as const satisfies readonly StatusPillStatus[];

/**
 * `StatusPill` is the status of a wish (AD-12), always spelled out: colour alone
 * never carries the meaning. It is not a control; the sandbox turns `status` and
 * `label` in the panel.
 */
const meta = {
  title: "UI/StatusPill",
  component: StatusPill,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The status of a wish (AD-12): a neutral plate with a 1 px frame and a coloured dot, and the status spelled out next to it. Colour alone never carries the meaning, so the word is always there.

What is not a prop:

- The dot colour (\`$status-open\` / \`$status-reserved\` / \`$status-closed\`) is decorative (\`aria-hidden\`): the label says «Открыт» / «Забронирован» / «Получен».
- The pill is not a control: it takes no press and has no focus state.
- The plate, the 6 px dot and the padding (10, half of \`icon-inline\`) come from the theme and do not change.
        `.trim(),
      },
    },
  },
  argTypes: {
    status: propDoc({
      description:
        "The AD-12 status: `open` — «Открыт», `reserved` — «Забронирован», `closed` — «Получен». It only picks the dot colour.",
      type: formatUnionType(STATUS_PILL_STATUSES),
      options: STATUS_PILL_STATUSES,
      required: true,
      defaultValue: "open",
    }),
    label: propDoc({
      description:
        "The status spelled out, already translated by the caller: the label is the meaning of the pill.",
      type: "string",
      required: true,
      control: "text",
    }),
  },
  args: {
    status: "open",
    label: "Открыт",
  },
} satisfies Meta<typeof StatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: the select changes the dot, the text field changes the word.
 * The component does not translate anything — the caller passes the label,
 * and the two are changed together in a real screen.
 */
export const Playground: Story = {};

/** The wish waits for a gift: the middle status, the one a list shows most often. */
export const Reserved: Story = {
  args: { status: "reserved", label: "Забронирован" },
};

export const Open: Story = {
  tags: ["!dev"],
};

export const Closed: Story = {
  tags: ["!dev"],
  args: { status: "closed", label: "Получен" },
};

/** All three in a row, the way a list mixes them. */
export const AllStatuses: Story = {
  tags: ["!dev"],
  render: function AllStatusesStory() {
    return (
      <XStack gap="$2" flexWrap="wrap" width={360}>
        <StatusPill status="open" label="Открыт" />
        <StatusPill status="reserved" label="Забронирован" />
        <StatusPill status="closed" label="Получен" />
      </XStack>
    );
  },
};

/** A long status line at 360 px: the pill grows with its text and wraps. */
export const LongLabelNarrow: Story = {
  tags: ["!dev"],
  args: {
    status: "reserved",
    label: "Забронирован до 4 ноября, подарок ещё не вручён",
  },
  globals: { viewport: { value: "w360" } },
};
