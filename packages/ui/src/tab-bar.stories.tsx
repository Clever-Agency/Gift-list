import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { NavItem } from "./nav-item";
import { TabBar, type TabBarProps } from "./tab-bar";

const TAB_SECTION_KEYS = ["wishlist", "search", "friends", "reservations", "profile"] as const;

type TabSectionKey = (typeof TAB_SECTION_KEYS)[number];

/**
 * The bar props plus the «выбранный раздел» catalog handle. The sections are the
 * ready-made five `NavItem`s of the product, so the catalog offers one select
 * instead of a children knob. The cast on `component` is what lets the Docs
 * controls see the handle; the component itself stays unchanged.
 */
type TabBarCatalogProps = TabBarProps & { active: TabSectionKey };

/** The five sections of `UX-A13` in the order of the product. */
const SECTIONS = [
  { key: "wishlist", label: "Вишлист", icon: <Heart />, href: "/" },
  { key: "search", label: "Поиск", icon: <Search />, href: "/search" },
  {
    key: "friends",
    label: "Друзья",
    secondary: "Друзья, 2 запроса",
    icon: <Users />,
    badge: 2,
    href: "/friends",
  },
  {
    key: "reservations",
    label: "Брони",
    secondary: "Мои брони",
    icon: <CalendarCheck />,
    href: "/reservations",
  },
  { key: "profile", label: "Профиль", icon: <User />, href: "/profile" },
] as const satisfies readonly {
  key: TabSectionKey;
  label: string;
  secondary?: string;
  icon: ReactNode;
  badge?: number;
  href: string;
}[];

/**
 * The bottom bar of compact and medium (`DESIGN.md` → `components.tab-bar`):
 * five sections of `UX-A13`, the first one «Вишлист», the active section marked
 * by the bar, weight and colour. The browser gets a `<nav aria-label="Разделы">`
 * of links; the phone announces each item as a tab.
 *
 * The sandbox turns the caption and the selected section in the panel; the five
 * `NavItem`s are the ready-made set of the product, each a real link.
 */
const meta = {
  title: "UI/TabBar",
  component: TabBar as ComponentType<TabBarCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The bottom bar of compact and medium (\`DESIGN.md\` → \`components.tab-bar\`): a \`surface\` strip with a 1 px top \`border\` and the height of \`spacing.tab-bar\`.

What is not a prop:

- The bar takes the five \`NavItem\`s of \`UX-A13\` in the product order. The sandbox builds them itself and offers «выбранный раздел» instead of a children knob.
- Every item is a real \`<a href>\` on the web, so «открыть в новой вкладке» and the context menu work without the router; a press navigates rather than changes a local tab.
- The bar itself is a \`<nav aria-label>\` landmark, not a \`tablist\`: the sections are URL transitions (\`EXPERIENCE.md\` → Доступность → Навигация).
- On the phone the bar keeps the home indicator with its own bottom inset and announces each item as a tab.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description: "The accessible name of the navigation landmark: «Разделы».",
      type: "string",
      required: true,
      control: "text",
    }),
    children: propDoc({
      description:
        "The five `NavItem`s in the order of `UX-A13`. The sandbox passes its own set; the showcases below may pass another one.",
      type: "ReactNode",
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    active: {
      name: "выбранный раздел",
      description:
        "Ручка каталога: какому пункту готового набора поставить `selected`. Меняется вместе с панелью, как у Switch.",
      control: "select",
      options: TAB_SECTION_KEYS,
      table: {
        category: "Ручки каталога",
        type: { summary: formatUnionType(TAB_SECTION_KEYS) },
        defaultValue: { summary: "wishlist" },
      },
    },
  },
  args: {
    label: "Разделы",
    testID: "tab-bar",
    active: "wishlist",
  },
} satisfies Meta<TabBarCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

function TabBarPreview({ active, children, ...barArgs }: TabBarCatalogProps) {
  const [selected, setSelected] = useState(active);

  useEffect(
    function syncActiveFromControls() {
      setSelected(active);
    },
    [active],
  );

  return (
    <TabBar {...barArgs}>
      {children ??
        SECTIONS.map(function section(item) {
          return (
            <NavItem
              key={item.key}
              label={item.label}
              secondary={"secondary" in item ? item.secondary : undefined}
              icon={item.icon}
              badge={"badge" in item ? item.badge : undefined}
              selected={item.key === selected}
              href={item.href}
              testID={`tab-${item.key}`}
            />
          );
        })}
    </TabBar>
  );
}

TabBarPreview.displayName = "TabBarPreview";

/**
 * The sandbox: turn «выбранный раздел» and the caption. The five items are the
 * product set with real links, so a press would navigate, not repaint the bar;
 * the selection follows the panel instead.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return (
      <XStack width={360} maxWidth="100%">
        <TabBarPreview {...args} />
      </XStack>
    );
  },
};

/** The five sections at 360 px, with the incoming-request badge on «Друзья». */
export const Sections: Story = {
  render: function SectionsStory(args) {
    return (
      <TabBarPreview {...args} testID="tab-bar">
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
      </TabBarPreview>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The same bar at the medium width: a tablet in portrait keeps the bottom tabs. */
export const Medium: Story = {
  tags: ["!dev"],
  render: function MediumStory(args) {
    return (
      <TabBarPreview {...args}>
        <NavItem label="Вишлист" icon={<Heart />} selected href="/" />
        <NavItem label="Поиск" icon={<Search />} selected={false} href="/search" />
        <NavItem label="Друзья" icon={<Users />} selected={false} href="/friends" />
        <NavItem label="Брони" icon={<CalendarCheck />} selected={false} href="/reservations" />
        <NavItem label="Профиль" icon={<User />} selected={false} href="/profile" />
      </TabBarPreview>
    );
  },
  globals: { viewport: { value: "w768" } },
};
