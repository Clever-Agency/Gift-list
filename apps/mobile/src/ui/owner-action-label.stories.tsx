import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { YStack } from "@gift-list/ui";
import { OwnerActionLabel } from "./owner-action-label";

/**
 * Story 5.6: полоса владельца на истёкшую бронь (`DESIGN.md` → OwnerActionLabel,
 * `EXPERIENCE.md` → «Подписи брони»). Тексты — из каталога i18n, поэтому story
 * показывает настоящие строки: «Срок брони истёк» и два ответа.
 *
 * Кнопки — обычные secondary: наведите мышь и пройдите Tab, чтобы увидеть живые
 * hover и focus; `busy` показывает занятость обоих ответов. Третье действие,
 * «Снять бронь», живёт в ⋮ карточки и здесь не рисуется.
 */
const meta = {
  title: "App/OwnerActionLabel",
  component: OwnerActionLabel,
  tags: ["autodocs"],
  args: {
    action: "EXPIRED_NO_REPLY",
    onReceived: function noop() {},
    onKeep: function noop() {},
  },
} satisfies Meta<typeof OwnerActionLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

function Strip({ children }: { children: ReactNode }) {
  return (
    <YStack width={328} padding="$3" backgroundColor="$background" gap="$2">
      {children}
    </YStack>
  );
}

Strip.displayName = "Strip";

export const Normal: Story = {
  render: function NormalStory(args) {
    return (
      <Strip>
        <OwnerActionLabel {...args} />
      </Strip>
    );
  },
};

/** Запрос keep уже ушёл: оба ответа заняты и не нажимаются. */
export const Busy: Story = {
  tags: ["!dev"],
  args: { busy: true },
  render: function BusyStory(args) {
    return (
      <Strip>
        <OwnerActionLabel {...args} />
      </Strip>
    );
  },
};

/** 360 px: длинная кириллица ответов переносится, полоса не переполняется. */
export const Narrow360: Story = {
  tags: ["!dev"],
  render: function Narrow360Story(args) {
    return (
      <Strip>
        <OwnerActionLabel {...args} />
      </Strip>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** Ещё уже: оба ответа переносятся по одному, текст не обрезается. */
export const VeryNarrow: Story = {
  tags: ["!dev"],
  render: function VeryNarrowStory(args) {
    return (
      <YStack width={240} padding="$3" backgroundColor="$background" gap="$2">
        <OwnerActionLabel {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
