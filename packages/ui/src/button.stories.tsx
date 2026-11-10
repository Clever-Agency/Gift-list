import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

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

/** `primary`: the one action of a screen. */
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

/** `reserve`: only «Куплю сам» and «Подтвердить» in the reservation confirm. */
export const Reserve: Story = {
  args: { variant: "reserve", label: "Куплю сам" },
};

export const ReserveDisabled: Story = {
  args: { variant: "reserve", label: "Куплю сам", disabled: true },
};

export const ReserveBusy: Story = {
  args: { variant: "reserve", label: "Куплю сам", busy: true },
};

/** `destructive`: an action that cannot be undone. */
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
