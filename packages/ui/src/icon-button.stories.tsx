import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import { IconButton } from "./icon-button";
import { Check, Close, Info, Star } from "./icons";

/**
 * `IconButton` is the icon-only control of v8: 44 × 44, radius 8, 1 px frame. Hover
 * fills `muted`, press dims to 90%, Tab shows the 2 px ring with a 2 px offset; the
 * icon is decorative and the accessible name comes from `label`.
 */
const meta = {
  title: "UI/IconButton",
  component: IconButton,
  args: {
    label: "Поделиться",
    icon: <Star size={20} />,
  },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Outline: Story = {};

/** Without the frame: a toolbar of icons still keeps the same 44 × 44 target. */
export const Plain: Story = {
  args: { variant: "plain" },
};

export const Disabled: Story = {
  args: { disabled: true },
};

/** Both variants side by side, as a card would show them. */
export const Row: Story = {
  render: function IconButtonRowStory() {
    return (
      <XStack gap="$2" alignItems="center">
        <IconButton label="Информация" icon={<Info size={20} />} />
        <IconButton label="Поделиться" icon={<Star size={20} />} />
        <IconButton label="Подробнее" icon={<Info size={20} />} variant="plain" />
        <IconButton label="Поделиться" icon={<Star size={20} />} disabled />
      </XStack>
    );
  },
};

/** At 360 px the row wraps instead of shrinking the targets. */
export const RowNarrow: Story = {
  render: function IconButtonRowNarrowStory() {
    return (
      <XStack gap="$2" flexWrap="wrap" width={328}>
        <IconButton label="Информация" icon={<Info size={20} />} />
        <IconButton label="Поделиться" icon={<Star size={20} />} />
        <IconButton label="Подробнее" icon={<Info size={20} />} variant="plain" />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * The answer to a friends request: 32 px circles in the same 44 px target — the
 * filled accept and the quiet decline. The accessible names are the row's labels.
 */
export const RequestActions: Story = {
  render: function RequestActionsStory() {
    return (
      <XStack gap="$2" alignItems="center">
        <IconButton
          label="Отклонить: Екатерина Шереметьева"
          size="sm"
          shape="round"
          icon={<Close size={16} />}
        />
        <IconButton
          label="Принять: Екатерина Шереметьева"
          size="sm"
          shape="round"
          variant="primary"
          icon={<Check size={16} />}
        />
      </XStack>
    );
  },
};
