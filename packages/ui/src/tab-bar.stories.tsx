import type { Meta, StoryObj } from "@storybook/react";
import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { NavItem } from "./nav-item";
import { TabBar } from "./tab-bar";

/**
 * The bottom bar of compact and medium (`DESIGN.md` → `components.tab-bar`):
 * five sections of `UX-A13`, the first one «Вишлист», the active section marked
 * by the bar, weight and colour. The browser gets a `<nav aria-label="Разделы">`
 * of links; the phone announces each item as a tab.
 */
const meta = {
  title: "UI/TabBar",
  component: TabBar,
  args: { label: "Разделы" },
} satisfies Meta<typeof TabBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The five sections at 360 px, with the incoming-request badge on «Друзья». */
export const Sections: Story = {
  render: function SectionsStory(args) {
    return (
      <TabBar {...args} testID="tab-bar">
        <NavItem label="Вишлист" icon={<Heart />} selected href="/" testID="tab-wishlist" />
        <NavItem label="Поиск" icon={<Search />} selected={false} href="/search" testID="tab-search" />
        <NavItem
          label="Друзья"
          secondary="Друзья, 2 запроса"
          icon={<Users />}
          badge={2}
          selected={false}
          href="/friends"
          testID="tab-friends"
        />
        <NavItem
          label="Брони"
          secondary="Мои брони"
          icon={<CalendarCheck />}
          selected={false}
          href="/reservations"
          testID="tab-reservations"
        />
        <NavItem label="Профиль" icon={<User />} selected={false} href="/profile" testID="tab-profile" />
      </TabBar>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The same bar at the medium width: a tablet in portrait keeps the bottom tabs. */
export const Medium: Story = {
  render: function MediumStory(args) {
    return (
      <TabBar {...args}>
        <NavItem label="Вишлист" icon={<Heart />} selected href="/" />
        <NavItem label="Поиск" icon={<Search />} selected={false} href="/search" />
        <NavItem label="Друзья" icon={<Users />} selected={false} href="/friends" />
        <NavItem label="Брони" icon={<CalendarCheck />} selected={false} href="/reservations" />
        <NavItem label="Профиль" icon={<User />} selected={false} href="/profile" />
      </TabBar>
    );
  },
  globals: { viewport: { value: "w768" } },
};
