import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { propDoc } from "../../../.storybook/argTypes";
import { Avatar } from "./avatar";
import { AppShell } from "./app-shell";
import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { NavItem } from "./nav-item";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";
import { Text } from "./text";

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

/** The ready-made frame: the side menu, the bottom bar and one page of content. */
function Shell({
  long = false,
  skipLabel = "Перейти к содержимому",
  testID,
}: {
  long?: boolean;
  skipLabel?: string;
  testID?: string;
}) {
  const friendsLabel = long ? "Друзья и запросы" : "Друзья";
  const reservationsLabel = long ? "Мои бронирования" : "Брони";
  return (
    <YStack flex={1} backgroundColor="$background">
      <AppShell
        skipLabel={skipLabel}
        testID={testID}
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

/**
 * The frame of the signed-in app (`DESIGN.md` → Навигация приложения): bottom
 * tabs below 1024 px, the 264 px side menu from 1024 px, one `main` landmark and
 * the skip link first in the Tab order. The story swaps the width with the
 * viewport toolbar; the shell itself reads the same `media.expanded` as the app.
 *
 * The shell is the page frame, so the stories take the viewport-height frame of
 * the screens (`screenFrame`): the shell draws `100vh`, and inside the padded
 * catalog surface that box was 48 px taller than the canvas, so the bottom bar
 * fell below the fold.
 */
const meta = {
  title: "UI/AppShell",
  component: AppShell,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    screenFrame: true,
    docs: {
      description: {
        component: `
The one frame of the signed-in app (\`DESIGN.md\` → Навигация приложения). Below 1024 px the bottom tabs stay under the content; from 1024 px the 264 px side menu takes over. The skip link is the first stop of the Tab order and jumps to the only \`main\` landmark (\`#main-content\`, \`tabIndex={-1}\`).

What is not a prop:

- \`sidebar\`, \`tabBar\` and the content are slots: the sandbox draws the ready-made frame of the product, not node knobs.
- The bottom bar stays mounted on every width and is only hidden on \`expanded\`: it registers the tab routes in \`TabList\`, so unmounting it would break the tabs after a resize.
- The bar's height is published through \`useTabBarInset\`, so a toast can stand above the bar on compact and medium.
- The width is the catalog viewport toolbar, not a prop; the shell reads the same \`media.expanded\` as the app.
        `.trim(),
      },
    },
  },
  argTypes: {
    skipLabel: propDoc({
      description:
        "The text of the skip link, e.g. «Перейти к содержимому» (`web.skipToContent`).",
      type: "string",
      required: true,
      control: "text",
    }),
    sidebar: propDoc({
      description:
        "The side menu of expanded screens; the caller builds it (`SidebarNav`). The sandbox passes a ready-made `Sidebar`.",
      type: "ReactNode",
      control: false,
    }),
    tabBar: propDoc({
      description:
        "The bottom bar of compact and medium; it stays mounted on every width. The sandbox passes a ready-made `TabBar`.",
      type: "ReactNode",
      control: false,
    }),
    children: propDoc({
      description: "The screen or the tabs' slot. The sandbox passes one page of content.",
      type: "ReactNode",
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    skipLabel: "Перейти к содержимому",
    testID: "app-shell",
  },
} satisfies Meta<typeof AppShell>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: write the skip-link text and resize the window with the viewport
 * toolbar — the shell itself swaps the bottom tabs for the side menu at 1024 px.
 * The sidebar, the bar and the page are the ready-made frame of the product.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <Shell skipLabel={args.skipLabel} testID={args.testID} />;
  },
};

/** The phone: the bottom tabs, the content above them, no side menu. */
export const Compact: Story = {
  render: function CompactStory() {
    return <Shell />;
  },
  globals: { viewport: { value: "w360" } },
};

/** The tablet in portrait: the same bottom tabs, a wider content column. */
export const Medium: Story = {
  tags: ["!dev"],
  render: function MediumStory() {
    return <Shell />;
  },
  globals: { viewport: { value: "w768" } },
};

/** The desktop: the side menu with the user card, no bottom tabs. */
export const Expanded: Story = {
  tags: ["!dev"],
  render: function ExpandedStory() {
    return <Shell />;
  },
  globals: { viewport: { value: "w1280" } },
};

/** Long Cyrillic labels at 360 px: captions ellipsize, the bar does not overflow. */
export const LongCyrillic: Story = {
  tags: ["!dev"],
  render: function LongCyrillicStory() {
    return <Shell long />;
  },
  globals: { viewport: { value: "w360" } },
};
