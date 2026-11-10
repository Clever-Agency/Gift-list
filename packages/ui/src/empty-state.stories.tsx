import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

/**
 * `EmptyState` is the empty list: a display title, one body line and at most one
 * primary CTA. The copy comes from `EXPERIENCE.md` → Empty states, via the app.
 */
const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  args: {
    title: "Здесь пока пусто",
    body: "Добавьте первое желание — его увидят друзья.",
    action: <Button label="Добавить желание" variant="primary" />,
  },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

/** With one CTA, the usual case. */
export const WithAction: Story = {};

/** Without a CTA, e.g. a public link page with no wishes. */
export const WithoutAction: Story = {
  args: {
    title: "В этом вишлисте пока нет желаний",
    body: undefined,
    action: undefined,
  },
};

/** A long title at 360 px: the display title wraps and stays centred. */
export const LongTitleNarrow: Story = {
  args: {
    title: "Вы ещё не добавили ни одного желания",
    body: "Самое время начать: нажмите «Добавить желание» и расскажите о том, что хочется получить.",
  },
  globals: { viewport: { value: "w360" } },
};
