import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { NavItem, type NavItemVariant } from "./nav-item";

const NAV_VARIANTS = ["tab", "side"] as const satisfies readonly NavItemVariant[];

/**
 * One item of the bottom tabs (`variant="tab"`) or the side menu (`variant="side"`),
 * `DESIGN.md` → Навигация приложения. The sandbox switches the variant and the
 * state, so the bar, the weight and the colour can be compared in one place.
 */
const meta = {
  title: "UI/NavItem",
  component: NavItem,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
One item of the bottom tabs or the side menu (\`DESIGN.md\` → Навигация приложения, \`components.tab-bar\` and \`components.nav-item\`). The selected section is marked by a 3 px \`primary\` bar, weight 600 and the \`primary\` colour — never by colour alone.

What is not a prop:

- The glyph is a slot: the screen passes its section icon, and the item tints it with the section colour in both themes.
- The badge count is drawn by \`UI/Badge\` and is part of the accessible name of the item, never a colour-only cue: «Друзья, 2 запроса».
- \`secondary\` is the full accessible name when the visible label is shortened («Брони» → «Мои брони»).
- \`isFocused\` comes from \`TabTrigger asChild\` and counts as selected.
- The browser half is a real \`<a href>\`: «открыть в новой вкладке» and the context menu work without the router. The phone half is a \`Pressable\` with \`role="tab"\`.
- Hover, press and focus are CSS states, not props: hover the item, hold it, press Tab.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description:
        "The visible label: a tab uses the short form («Брони»), a sidebar item the full one.",
      type: "string",
      required: true,
      control: "text",
    }),
    secondary: propDoc({
      description:
        "The full accessible name when the visible label is shortened, e.g. «Мои брони» or «Друзья, 2 запроса». Without it the name is the label plus the badge count.",
      type: "string",
      control: "text",
    }),
    icon: propDoc({
      description:
        "The section glyph, handed in by the screen (`Heart`, `Search`, …); it takes the section colour of the item.",
      type: "ReactNode",
      required: true,
      control: false,
    }),
    badge: propDoc({
      description: "The count in the badge; 0 and `undefined` draw no badge at all.",
      type: "number",
      control: "number",
    }),
    selected: propDoc({
      description:
        "The current section: the 3 px `primary` bar, weight 600 and the `primary` colour, plus `aria-current` on the web and `selected` on a phone.",
      type: "boolean",
      required: true,
      defaultValue: "false",
    }),
    isFocused: propDoc({
      description:
        "Set by `TabTrigger asChild` on the active route; it counts as selected.",
      type: "boolean",
      defaultValue: "false",
    }),
    variant: propDoc({
      description:
        "`tab` — a share of the bottom bar: the glyph and a caption under it. `side` — a row of the desktop menu: the glyph, the label and the badge on the right.",
      type: formatUnionType(NAV_VARIANTS),
      options: NAV_VARIANTS,
      defaultValue: "tab",
    }),
    href: propDoc({
      description:
        "The section address. The browser draws a real `<a href>` and the link itself navigates; a phone has no anchor and uses `onPress`.",
      type: "string",
      control: "text",
    }),
    onPress: propDoc({
      description:
        "The press of a phone, and the callback of the web anchor; not a control.",
      type: "(event?: unknown) => void",
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    label: "Друзья",
    secondary: "Друзья, 2 запроса",
    icon: <Users />,
    badge: 2,
    selected: false,
    isFocused: false,
    variant: "tab",
    href: "/friends",
    testID: "nav-item",
  },
} satisfies Meta<typeof NavItem>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: switch `variant` between the bottom tab and the sidebar row — the
 * frame changes with it — and turn `label`, `badge` and `selected` in the panel.
 * The glyph stays a ready-made `Users`, and `href` keeps the item a real link.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    const { variant, ...itemArgs } = args;
    if (variant === "side") {
      return (
        <YStack width={264} maxWidth="100%" padding="$2" backgroundColor="$surface">
          <NavItem {...itemArgs} variant="side" />
        </YStack>
      );
    }
    return (
      <XStack width={360} maxWidth="100%" backgroundColor="$surface">
        <NavItem {...itemArgs} variant="tab" />
      </XStack>
    );
  },
};

/** Incoming requests add the count pill; the full name says «Друзья, 2 запроса». */
export const TabWithBadge: Story = {
  render: function TabWithBadgeStory(args) {
    return (
      <XStack width={360} maxWidth="100%" backgroundColor="$surface">
        <NavItem {...args} variant="tab" testID="nav-tab-badge" />
      </XStack>
    );
  },
};

/** A resting tab: no bar, the label and the glyph in `muted-foreground`. */
export const Tab: Story = {
  tags: ["!dev"],
  args: { badge: undefined, secondary: undefined, label: "Вишлист", icon: <Heart />, href: "/" },
  render: function TabStory(args) {
    return (
      <XStack width={360} maxWidth="100%" backgroundColor="$surface">
        <NavItem {...args} variant="tab" testID="nav-tab" />
      </XStack>
    );
  },
};

/** The current tab: the bar, the 600 label and the `primary` glyph. */
export const TabActive: Story = {
  tags: ["!dev"],
  args: { badge: undefined, secondary: undefined, label: "Вишлист", icon: <Heart />, href: "/", selected: true },
  render: function TabActiveStory(args) {
    return (
      <XStack width={360} maxWidth="100%" backgroundColor="$surface">
        <NavItem {...args} variant="tab" testID="nav-tab-active" />
      </XStack>
    );
  },
};

/** Long Cyrillic copy stays on one line with an ellipsis instead of overflowing. */
export const TabLongCyrillic: Story = {
  tags: ["!dev"],
  args: {
    label: "Мои бронирования",
    secondary: undefined,
    badge: undefined,
    icon: <CalendarCheck />,
    href: "/reservations",
  },
  render: function TabLongCyrillicStory(args) {
    return (
      <XStack width={360} maxWidth="100%" backgroundColor="$surface">
        <NavItem {...args} variant="tab" testID="nav-tab-long" />
      </XStack>
    );
  },
};

/** The five sections at 360 px: equal shares, captions do not overflow. */
export const TabsAt360: Story = {
  tags: ["!dev"],
  render: function TabsAt360Story() {
    return (
      <XStack width={360} maxWidth="100%" backgroundColor="$surface" borderTopWidth={1} borderColor="$border">
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
  tags: ["!dev"],
  args: {
    variant: "side",
    label: "Мои брони",
    secondary: undefined,
    badge: undefined,
    icon: <CalendarCheck />,
    href: "/reservations",
    selected: false,
  },
  render: function SideStory(args) {
    return (
      <YStack width={264} padding="$2" backgroundColor="$surface">
        <NavItem {...args} variant="side" testID="nav-side" />
      </YStack>
    );
  },
};

/** The current sidebar item: `muted` background and the 3 px `primary` bar on the left. */
export const SideActive: Story = {
  tags: ["!dev"],
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
        <NavItem {...args} variant="side" testID="nav-side-active" />
      </YStack>
    );
  },
};

/** Long Cyrillic in the 264 px menu: one line with an ellipsis, the badge stays right. */
export const SideLongCyrillic: Story = {
  tags: ["!dev"],
  args: {
    variant: "side",
    label: "Мои бронирования и подарки",
    secondary: undefined,
    icon: <CalendarCheck />,
    badge: 12,
    href: "/reservations",
    selected: false,
  },
  render: function SideLongCyrillicStory(args) {
    return (
      <YStack width={264} padding="$2" backgroundColor="$surface">
        <NavItem {...args} variant="side" testID="nav-side-long" />
      </YStack>
    );
  },
  globals: { viewport: { value: "w1280" } },
};
