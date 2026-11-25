import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { Avatar } from "./avatar";
import { AppShell } from "./app-shell";
import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { NavItem } from "./nav-item";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";
import { Text } from "./text";

/**
 * The frame of the signed-in app (`DESIGN.md` → Навигация приложения): bottom
 * tabs below 1024 px, the 264 px side menu from 1024 px, one `main` landmark and
 * the skip link first in the Tab order. The story swaps the width with the
 * viewport toolbar; the shell itself reads the same `media.expanded` as the app.
 *
 * The shell is the page frame, so the story takes the viewport-height frame of the
 * screens (`screenFrame`): the shell draws `100vh`, and inside the padded catalog
 * surface that box was 48 px taller than the canvas, so the bottom bar fell below
 * the fold.
 */
const meta = {
  title: "UI/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen", screenFrame: true },
  args: { skipLabel: "Перейти к содержимому" },
} satisfies Meta<typeof AppShell>;

export default meta;

type Story = StoryObj<typeof meta>;

function Page() {
  return (
    <YStack padding="$4" gap="$2">
      <Text kind="display-sm">Мой вишлист</Text>
      <Text kind="body">
        Желания, которые легко исполнить: наушники с шумоподавлением, сборник стихов и тёплый плед.
      </Text>
    </YStack>
  );
}

Page.displayName = "Page";

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

function Shell({ long = false }: { long?: boolean }) {
  const friendsLabel = long ? "Друзья и запросы" : "Друзья";
  const reservationsLabel = long ? "Мои бронирования" : "Брони";
  return (
    <YStack flex={1} backgroundColor="$background">
      <AppShell
        skipLabel="Перейти к содержимому"
        sidebar={
          <Sidebar
            brand="Подарки"
            label="Разделы"
            footer={<UserCard name="Алёна Ковалёва" nick="alena" />}
          >
            <NavItem variant="side" label="Мой вишлист" icon={<Heart />} selected href="/" />
            <NavItem variant="side" label="Поиск" icon={<Search />} selected={false} href="/search" />
            <NavItem
              variant="side"
              label={friendsLabel}
              secondary="Друзья, 2 запроса"
              icon={<Users />}
              badge={2}
              selected={false}
              href="/friends"
            />
            <NavItem
              variant="side"
              label={long ? "Мои бронирования" : "Мои брони"}
              icon={<CalendarCheck />}
              selected={false}
              href="/reservations"
            />
            <NavItem variant="side" label="Профиль" icon={<User />} selected={false} href="/profile" />
          </Sidebar>
        }
        tabBar={
          <TabBar label="Разделы">
            <NavItem label="Вишлист" icon={<Heart />} selected href="/" />
            <NavItem label="Поиск" icon={<Search />} selected={false} href="/search" />
            <NavItem
              label={friendsLabel}
              secondary="Друзья, 2 запроса"
              icon={<Users />}
              badge={2}
              selected={false}
              href="/friends"
            />
            <NavItem label={reservationsLabel} icon={<CalendarCheck />} selected={false} href="/reservations" />
            <NavItem label="Профиль" icon={<User />} selected={false} href="/profile" />
          </TabBar>
        }
      >
        <Page />
      </AppShell>
    </YStack>
  );
}

Shell.displayName = "Shell";

/** The phone: the bottom tabs, the content above them, no side menu. */
export const Compact: Story = {
  render: function CompactStory() {
    return <Shell />;
  },
  globals: { viewport: { value: "w360" } },
};

/** The tablet in portrait: the same bottom tabs, a wider content column. */
export const Medium: Story = {
  render: function MediumStory() {
    return <Shell />;
  },
  globals: { viewport: { value: "w768" } },
};

/** The desktop: the side menu with the user card, no bottom tabs. */
export const Expanded: Story = {
  render: function ExpandedStory() {
    return <Shell />;
  },
  globals: { viewport: { value: "w1280" } },
};

/** Long Cyrillic labels at 360 px: captions ellipsize, the bar does not overflow. */
export const LongCyrillic: Story = {
  render: function LongCyrillicStory() {
    return <Shell long />;
  },
  globals: { viewport: { value: "w360" } },
};
