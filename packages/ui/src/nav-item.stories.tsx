import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { NavItem } from "./nav-item";

/**
 * One item of the bottom tabs (`variant="tab"`) or the side menu (`variant="side"`),
 * `DESIGN.md` → Навигация приложения. The active section has a 3 px `primary`
 * bar, weight 600 and the `primary` colour; the badge count is part of the
 * accessible name of the item, never a colour-only cue.
 */
const meta = {
  title: "UI/NavItem",
  component: NavItem,
  args: {
    label: "Вишлист",
    icon: <Heart />,
    selected: false,
    variant: "tab",
    href: "/",
  },
} satisfies Meta<typeof NavItem>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A resting tab: no bar, the label and the glyph in `muted-foreground`. */
export const Tab: Story = {
  render: function TabStory(args) {
    return (
      <XStack width={360} backgroundColor="$surface">
        <NavItem {...args} testID="nav-tab" />
      </XStack>
    );
  },
};

/** The current tab: the bar, the 600 label and the `primary` glyph. */
export const TabActive: Story = {
  args: { selected: true },
  render: function TabActiveStory(args) {
    return (
      <XStack width={360} backgroundColor="$surface">
        <NavItem {...args} testID="nav-tab-active" />
      </XStack>
    );
  },
};

/** Incoming requests add the count pill; the full name says «Друзья, 2 запроса». */
export const TabWithBadge: Story = {
  args: {
    label: "Друзья",
    secondary: "Друзья, 2 запроса",
    icon: <Users />,
    badge: 2,
    href: "/friends",
  },
  render: function TabWithBadgeStory(args) {
    return (
      <XStack width={360} backgroundColor="$surface">
        <NavItem {...args} testID="nav-tab-badge" />
      </XStack>
    );
  },
};

/** Long Cyrillic copy stays on one line with an ellipsis instead of overflowing. */
export const TabLongCyrillic: Story = {
  args: { label: "Мои бронирования", icon: <CalendarCheck />, href: "/reservations" },
  render: function TabLongCyrillicStory(args) {
    return (
      <XStack width={360} backgroundColor="$surface">
        <NavItem {...args} testID="nav-tab-long" />
      </XStack>
    );
  },
};

/** The five sections at 360 px: equal shares, captions do not overflow. */
export const TabsAt360: Story = {
  render: function TabsAt360Story() {
    return (
      <XStack width={360} backgroundColor="$surface" borderTopWidth={1} borderColor="$border">
        <NavItem label="Вишлист" icon={<Heart />} selected href="/" />
        <NavItem label="Поиск" icon={<Search />} selected={false} href="/search" />
        <NavItem label="Друзья" icon={<Users />} badge={2} selected={false} href="/friends" />
        <NavItem label="Брони" icon={<CalendarCheck />} selected={false} href="/reservations" />
        <NavItem label="Профиль" icon={<User />} selected={false} href="/profile" />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A resting sidebar item: the glyph and the full label. */
export const Side: Story = {
  args: {
    variant: "side",
    label: "Мои брони",
    icon: <CalendarCheck />,
    href: "/reservations",
  },
  render: function SideStory(args) {
    return (
      <YStack width={264} padding="$2" backgroundColor="$surface">
        <NavItem {...args} testID="nav-side" />
      </YStack>
    );
  },
};

/** The current sidebar item: `muted` background and the 3 px `primary` bar on the left. */
export const SideActive: Story = {
  args: {
    variant: "side",
    label: "Друзья",
    secondary: "Друзья, 2 запроса",
    icon: <Users />,
    badge: 2,
    selected: true,
    href: "/friends",
  },
  render: function SideActiveStory(args) {
    return (
      <YStack width={264} padding="$2" backgroundColor="$surface">
        <NavItem {...args} testID="nav-side-active" />
      </YStack>
    );
  },
};

/** Long Cyrillic in the 264 px menu: one line with an ellipsis, the badge stays right. */
export const SideLongCyrillic: Story = {
  args: {
    variant: "side",
    label: "Мои бронирования и подарки",
    icon: <CalendarCheck />,
    badge: 12,
    href: "/reservations",
  },
  render: function SideLongCyrillicStory(args) {
    return (
      <YStack width={264} padding="$2" backgroundColor="$surface">
        <NavItem {...args} testID="nav-side-long" />
      </YStack>
    );
  },
  globals: { viewport: { value: "w1280" } },
};
