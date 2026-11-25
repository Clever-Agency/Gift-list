import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { Avatar } from "./avatar";
import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { NavItem } from "./nav-item";
import { Sidebar, type SidebarProps } from "./sidebar";
import { Text } from "./text";

const SIDEBAR_SECTION_KEYS = ["wishlist", "search", "friends", "reservations", "profile"] as const;

type SidebarSectionKey = (typeof SIDEBAR_SECTION_KEYS)[number];

/**
 * The menu props plus the «есть подвал» and «выбранный раздел» catalog handles.
 * The sections and the user card are ready-made samples, so the panel keeps a
 * switch and a select instead of node knobs. The cast on `component` is what lets
 * the Docs controls see the handles; the component itself stays unchanged.
 */
type SidebarCatalogProps = SidebarProps & {
  hasFooter: boolean;
  active: SidebarSectionKey;
};

/** The five sections of the product, in the order the menu draws them. */
const SECTIONS = [
  { key: "wishlist", label: "Мой вишлист", icon: <Heart />, href: "/" },
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
    label: "Мои брони",
    icon: <CalendarCheck />,
    href: "/reservations",
  },
  { key: "profile", label: "Профиль", icon: <User />, href: "/profile" },
] as const satisfies readonly {
  key: SidebarSectionKey;
  label: string;
  secondary?: string;
  icon: ReactNode;
  badge?: number;
  href: string;
}[];

/** The ready-made user card of the «есть подвал» handle. */
const READY_FOOTER = <UserCard name="Алёна Ковалёва" nick="alena" />;

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
  component: Sidebar as ComponentType<SidebarCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    screenFrame: true,
    docs: {
      description: {
        component: `
The 264 px side menu of expanded and wide screens (\`DESIGN.md\` → \`components.sidebar\`): \`surface\`, a 1 px \`border\` on the right, the brand on top, the sections below and the user card at the bottom.

What is not a prop:

- The root is a navigation landmark with the \`label\`; the sections themselves are \`NavItem\`s. The sandbox builds the product set and offers «выбранный раздел» instead of a children knob.
- Every section is a real \`<a href>\` on the web, so a press navigates rather than changes a local selection; the sandbox follows its panel.
- The user card is a slot: «есть подвал» stands a ready-made one in.
- The menu is not drawn on compact and medium, where the bottom tabs take over.
        `.trim(),
      },
    },
  },
  argTypes: {
    brand: propDoc({
      description: `The product name at the top of the menu (\`BRAND_NAME\`), drawn in \`display-sm\`.`,
      type: "string",
      required: true,
      control: "text",
    }),
    label: propDoc({
      description: "The accessible name of the navigation landmark: «Разделы».",
      type: "string",
      required: true,
      control: "text",
    }),
    children: propDoc({
      description:
        "The `NavItem`s of the sections. The sandbox passes the ready-made product set; the showcases below may pass another one.",
      type: "ReactNode",
      control: false,
    }),
    footer: propDoc({
      description:
        "The user card at the bottom of the menu; the caller builds it. «есть подвал» stands a ready-made card in.",
      type: "ReactNode",
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    hasFooter: {
      name: "есть подвал",
      description: "Ручка каталога: показать в слоте `footer` готовую карточку пользователя.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    active: {
      name: "выбранный раздел",
      description:
        "Ручка каталога: какому пункту готового набора поставить `selected`. Меняется вместе с панелью, как у Switch.",
      control: "select",
      options: SIDEBAR_SECTION_KEYS,
      table: {
        category: "Ручки каталога",
        type: { summary: formatUnionType(SIDEBAR_SECTION_KEYS) },
        defaultValue: { summary: "wishlist" },
      },
    },
  },
  args: {
    brand: "Подарки",
    label: "Разделы",
    testID: "sidebar",
    hasFooter: false,
    active: "wishlist",
  },
} satisfies Meta<SidebarCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

function SidebarPreview({
  hasFooter,
  active,
  footer,
  children,
  ...menuArgs
}: SidebarCatalogProps) {
  const [selected, setSelected] = useState(active);

  useEffect(
    function syncActiveFromControls() {
      setSelected(active);
    },
    [active],
  );

  return (
    <YStack flex={1} backgroundColor="$background">
      <Sidebar {...menuArgs} footer={hasFooter ? (footer ?? READY_FOOTER) : footer}>
        {children ??
          SECTIONS.map(function section(item) {
            return (
              <NavItem
                key={item.key}
                variant="side"
                label={item.label}
                secondary={"secondary" in item ? item.secondary : undefined}
                icon={item.icon}
                badge={"badge" in item ? item.badge : undefined}
                selected={item.key === selected}
                href={item.href}
                testID={`side-${item.key}`}
              />
            );
          })}
      </Sidebar>
    </YStack>
  );
}

SidebarPreview.displayName = "SidebarPreview";

/**
 * The sandbox: write the brand, flip «есть подвал» and pick the current section.
 * The sections are real links of the product, so a press navigates; the selection
 * follows the panel instead.
 */
export const Playground: Story = {
  args: { hasFooter: true },
  render: function PlaygroundStory(args) {
    return <SidebarPreview {...args} />;
  },
  globals: { viewport: { value: "w1280" } },
};

/** The menu at the desktop width: the user card sits at the bottom. */
export const Desktop: Story = {
  args: { hasFooter: true },
  render: function DesktopStory(args) {
    return (
      <SidebarPreview {...args} testID="sidebar" footer={<UserCard name="Алёна Ковалёва" nick="alena" />}>
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
      </SidebarPreview>
    );
  },
  globals: { viewport: { value: "w1280" } },
};

/** Long Cyrillic in the brand, a section and the user card: one line, no overflow. */
export const LongCyrillic: Story = {
  tags: ["!dev"],
  args: { brand: "Подарки и желания", hasFooter: true },
  render: function LongCyrillicStory(args) {
    return (
      <SidebarPreview
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
      </SidebarPreview>
    );
  },
  globals: { viewport: { value: "w1280" } },
};
