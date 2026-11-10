import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { Button } from "./button";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * Hover, press and focus are CSS states Tamagui paints from media queries: hover the
 * button, hold it, press Tab. On hover the fill of `primary`, `reserve` and
 * `destructive` darkens by 8% (`primary-hover`, `accent-hover`,
 * `destructive-hover` in `DESIGN.md` → Colors); `secondary` darkens its frame and
 * `ghost` takes the `muted` fill. A disabled or busy button keeps its 40% / 60% dim
 * and does not react to hover or press at all (`DESIGN.md` → Состояния кнопок,
 * DECISION 2026-11-10): it is painted by a variant value without those states.
 */
const meta = {
  title: "UI/Button",
  component: Button,
  args: {
    label: "Добавить желание",
    onPress: noop,
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `primary`: the one action of a screen. Hover it: the fill goes to `primary-hover`, 8.04:1 for the label. */
export const Primary: Story = {
  args: { variant: "primary" },
};

export const PrimaryDisabled: Story = {
  args: { variant: "primary", disabled: true },
};

export const PrimaryBusy: Story = {
  args: { variant: "primary", busy: true },
};

/** `secondary`: a side action next to the primary one. */
export const Secondary: Story = {
  args: { variant: "secondary", label: "Отмена" },
};

export const SecondaryDisabled: Story = {
  args: { variant: "secondary", label: "Отмена", disabled: true },
};

export const SecondaryBusy: Story = {
  args: { variant: "secondary", label: "Отмена", busy: true },
};

/** `ghost`: a quiet action, e.g. an icon-only control inside a card. */
export const Ghost: Story = {
  args: { variant: "ghost", label: "Поделиться" },
};

export const GhostDisabled: Story = {
  args: { variant: "ghost", label: "Поделиться", disabled: true },
};

export const GhostBusy: Story = {
  args: { variant: "ghost", label: "Поделиться", busy: true },
};

/** `reserve`: only «Куплю сам» and «Подтвердить» in the reservation confirm. Hover: `accent-hover`, 5.65:1. */
export const Reserve: Story = {
  args: { variant: "reserve", label: "Куплю сам" },
};

export const ReserveDisabled: Story = {
  args: { variant: "reserve", label: "Куплю сам", disabled: true },
};

export const ReserveBusy: Story = {
  args: { variant: "reserve", label: "Куплю сам", busy: true },
};

/** `destructive`: an action that cannot be undone. Hover: `destructive-hover`, 7.40:1. */
export const Destructive: Story = {
  args: { variant: "destructive", label: "Удалить желание" },
};

export const DestructiveDisabled: Story = {
  args: { variant: "destructive", label: "Удалить желание", disabled: true },
};

export const DestructiveBusy: Story = {
  args: { variant: "destructive", label: "Удалить желание", busy: true },
};

/**
 * Hover and press are CSS states Tamagui paints from media queries; hover the button
 * or hold it to see them. There is no prop that forces them.
 */
export const PrimaryFullWidth: Story = {
  args: { variant: "primary", fullWidth: true },
};

/**
 * The three hover fills side by side at 360 px: hover each button in turn —
 * `primary` `#2F5D3A` → `primary-hover` `#2B5635`, `reserve` `#D4A017` →
 * `accent-hover` `#C39315`, `destructive` `#B42318` → `destructive-hover` `#A62016`.
 * The rows under them show the same fills dimmed by `disabled` and `busy`: hover and
 * hold those — the fill stays as it is (DECISION 2026-11-10, t312u).
 */
export const HoverMatrixNarrow: Story = {
  render: function HoverMatrixNarrowStory() {
    return (
      <YStack width={360} gap="$3">
        <XStack gap="$2" flexWrap="wrap">
          <Button label="Сохранить" variant="primary" onPress={noop} />
          <Button label="Куплю сам" variant="reserve" onPress={noop} />
          <Button label="Удалить" variant="destructive" onPress={noop} />
        </XStack>
        <XStack gap="$2" flexWrap="wrap">
          <Button label="Сохранить" variant="primary" onPress={noop} disabled />
          <Button label="Куплю сам" variant="reserve" onPress={noop} disabled />
          <Button label="Удалить" variant="destructive" onPress={noop} disabled />
        </XStack>
        <XStack gap="$2" flexWrap="wrap">
          <Button label="Сохраняем…" variant="primary" onPress={noop} busy />
          <Button label="Бронируем…" variant="reserve" onPress={noop} busy />
          <Button label="Удаляем…" variant="destructive" onPress={noop} busy />
        </XStack>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
