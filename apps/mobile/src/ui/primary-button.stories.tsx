import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { PrimaryButton } from "./primary-button";

/**
 * The primary action of a screen. The wrapper keeps the old `disabled` contract:
 * while the request runs the button is `busy`, which a screen reader hears as
 * disabled — a second press is dropped (`DESIGN.md` → components button).
 */
const meta = {
  title: "App/PrimaryButton",
  component: PrimaryButton,
  args: { label: "Сохранить", onPress: noop },
} satisfies Meta<typeof PrimaryButton>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** Ready to press. */
export const Default: Story = {};

/** The request is in flight: the label stays, the control is announced busy. */
export const DisabledWhileSaving: Story = {
  args: { label: "Сохраняем…", disabled: true },
};

/** A long Cyrillic label at 360 px: the button keeps the page gutter. */
export const LongLabelNarrow: Story = {
  args: { label: "Добавить желание в вишлист" },
  render: function LongLabelNarrowStory(args) {
    return (
      <YStack width={328}>
        <PrimaryButton {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
