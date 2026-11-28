import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@gift-list/ui";
import { ProfileMenu } from "./profile-menu";

/**
 * «Профиль» (Story 6.2, CLE-129; Story 10.1): строки «Мой профиль» с подписью
 * «Как меня видят другие», «Подборки», «Настройки», «Написать в техподдержку»
 * и «Выйти». Меню презентационное: переходы и выход передаёт экран, каталог
 * подставляет пустые обработчики.
 */
const meta = {
  title: "App/ProfileMenu",
  component: ProfileMenu,
  tags: ["autodocs"],
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof ProfileMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** Телефон 360 px: все пять строк, высота строки 56, зона касания больше 44. */
export const Compact: Story = {
  args: {
    onOpenProfile: noop,
    onOpenCollections: noop,
    onOpenSettings: noop,
    onSignOut: noop,
  },
  render: function CompactStory(args) {
    return (
      <XStack width={328} padding={16}>
        <ProfileMenu {...args} />
      </XStack>
    );
  },
};

/** Широкая колонка: меню читается как список и не растягивается на весь экран. */
export const Wide: Story = {
  tags: ["!dev"],
  args: {
    onOpenProfile: noop,
    onOpenCollections: noop,
    onOpenSettings: noop,
    onSignOut: noop,
  },
  globals: { viewport: { value: "w1280" } },
  render: function WideStory(args) {
    return (
      <XStack width={720} padding={16}>
        <ProfileMenu {...args} />
      </XStack>
    );
  },
};

/** Выход в полёте: строка «Выйти» показана недоступной, второй раз не нажать. */
export const SigningOut: Story = {
  args: {
    onOpenProfile: noop,
    onOpenCollections: noop,
    onOpenSettings: noop,
    onSignOut: noop,
    signingOut: true,
  },
  render: function SigningOutStory(args) {
    return (
      <XStack width={328} padding={16}>
        <ProfileMenu {...args} />
      </XStack>
    );
  },
};

/**
 * Узкая колонка 240 px: подписи каталога самые короткие («Мой профиль»,
 * «Настройки»), и на этой ширине видно, что строка переносится, а не обрезается;
 * высота строки — `min-height`, зона касания остаётся больше 44.
 */
export const Narrow: Story = {
  tags: ["!dev"],
  args: {
    onOpenProfile: noop,
    onOpenCollections: noop,
    onOpenSettings: noop,
    onSignOut: noop,
  },
  render: function NarrowStory(args) {
    return (
      <XStack width={240} padding={16}>
        <ProfileMenu {...args} />
      </XStack>
    );
  },
};
