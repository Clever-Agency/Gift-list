import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { Avatar } from "./avatar";
import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { NavItem } from "./nav-item";
import { Sidebar } from "./sidebar";
import { Text } from "./text";

/**
 * `DESIGN.md` → `components.sidebar`: the 264 px menu of expanded and wide
 * screens — the brand on top, the five sections, the user card at the bottom.
 * On compact and medium the bottom tabs replace it.
 *
 * The menu is as tall as the page, so the stories take the viewport-height frame of
 * the screens (`screenFrame`): a `100vh` menu inside the padded catalog surface was
 * 48 px taller than the canvas and its footer was cut at the bottom.
 */
const meta = {
  title: "UI/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen", screenFrame: true },
  args: { brand: "Подарки", label: "Разделы" },
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

function UserCard({ name, nick }: { name: string; nick: string }) {
  return (
    <XStack alignItems="center" gap="$2" paddingHorizontal="$3" paddingVertical="$2">
      <Avatar name={name} size="md" decorative />
      <YStack flex={1} minWidth={0}>
        <Text kind="body-strong" numberOfLines={1}>
          {name}
        </Text>
        <Text kind="body-sm" tone="muted" numberOfLines={1}>
          @{nick}
        </Text>
      </YStack>
    </XStack>
  );
}

UserCard.displayName = "UserCard";

/** The menu at the desktop width: the user card sits at the bottom. */
export const Desktop: Story = {
  render: function DesktopStory(args) {
    return (
      <YStack flex={1} backgroundColor="$background">
        <Sidebar
          {...args}
          testID="sidebar"
          footer={<UserCard name="Алёна Ковалёва" nick="alena" />}
        >
          <NavItem variant="side" label="Мой вишлист" icon={<Heart />} selected href="/" />
          <NavItem variant="side" label="Поиск" icon={<Search />} selected={false} href="/search" />
          <NavItem
            variant="side"
            label="Друзья"
            secondary="Друзья, 2 запроса"
            icon={<Users />}
            badge={2}
            selected={false}
            href="/friends"
          />
          <NavItem
            variant="side"
            label="Мои брони"
            icon={<CalendarCheck />}
            selected={false}
            href="/reservations"
          />
          <NavItem variant="side" label="Профиль" icon={<User />} selected={false} href="/profile" />
        </Sidebar>
      </YStack>
    );
  },
  globals: { viewport: { value: "w1280" } },
};

/** Long Cyrillic in the brand, a section and the user card: one line, no overflow. */
export const LongCyrillic: Story = {
  args: { brand: "Подарки и желания" },
  render: function LongCyrillicStory(args) {
    return (
      <YStack flex={1} backgroundColor="$background">
        <Sidebar
          {...args}
          testID="sidebar-long"
          footer={<UserCard name="Александра Константинопольская" nick="alexandra_konstantinopolskaya" />}
        >
          <NavItem
            variant="side"
            label="Мои бронирования и подарки"
            icon={<CalendarCheck />}
            badge={12}
            selected
            href="/reservations"
          />
          <NavItem variant="side" label="Друзья" icon={<Users />} selected={false} href="/friends" />
        </Sidebar>
      </YStack>
    );
  },
  globals: { viewport: { value: "w1280" } },
};
