import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { EmptyState } from "./empty-state";
import { PrimaryButton } from "./primary-button";

/**
 * The app's empty state (`DESIGN.md` → EmptyState): a display title, one body line
 * and at most one primary call to action. The screen passes the copy and the
 * action; nothing is translated here.
 */
const meta = {
  title: "App/EmptyState",
  component: EmptyState,
  args: {
    title: "Пока нет желаний",
    body: "Добавьте мечту — подарки, эмоции или что-то важное.",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** The owner's list with its one CTA. */
export const WithAction: Story = {
  args: {
    action: <PrimaryButton label="Добавить желание" onPress={noop} />,
  },
  render: function WithActionStory(args) {
    return (
      <YStack width={328}>
        <EmptyState {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A link visitor's list: no CTA, because a visitor cannot add a wish. */
export const TextOnly: Story = {
  args: { title: "Пока нет открытых желаний", body: undefined },
};

/** Long copy at 360 px: the letter-spaced display title wraps without clipping. */
export const LongCopyNarrow: Story = {
  args: {
    title: "Пока нет открытых желаний, доступных вам",
    body: "Ссылка действует, но владелец скрыл желания от вас или ещё ничего не добавил. Загляните позже.",
    action: <PrimaryButton label="Мой вишлист" onPress={noop} />,
  },
  render: function LongCopyNarrowStory(args) {
    return (
      <YStack width={328}>
        <EmptyState {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
