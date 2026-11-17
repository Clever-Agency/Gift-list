import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { NavLink } from "./nav-link";

/**
 * A navigation link of the anonymous screens: the router's `Link` around the
 * shared `LinkText`. The catalog mocks the router (no app routes are mounted), but
 * it still renders a real `<a>` with the href the screen passes, so hover and the
 * focus ring are the component's own CSS, not a painted imitation.
 */
const meta = {
  title: "App/NavLink",
  component: NavLink,
  args: { href: "/", children: "На главную" },
} satisfies Meta<typeof NavLink>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** The usual link of the 404 and auth screens. */
export const Default: Story = {};

/** `onPress` runs before navigation: the catalog counts presses instead of leaving. */
export const WithPressHandler: Story = {
  args: { onPress: noop, children: "Забыли пароль?" },
};

/** A link whose state is handed to the target screen by `onPress`. */
export const ToRegistration: Story = {
  args: { href: "/register", children: "Зарегистрироваться" },
};

/** The focus ring is the real `:focus-visible` state: press Tab in the story. */
export const Focused: Story = {
  render: function FocusedStory() {
    return (
      <YStack gap="$3" width={328}>
        <NavLink href="/login">Войти</NavLink>
        <NavLink href="/register">Зарегистрироваться</NavLink>
      </YStack>
    );
  },
  play: focusSecondLink,
};

function focusSecondLink({ canvasElement }: { canvasElement: HTMLElement }) {
  const links = canvasElement.querySelectorAll<HTMLElement>("a");
  links[1]?.focus();
}

/** Two links in one column at 360 px: the gutter keeps them inside the screen. */
export const ColumnNarrow: Story = {
  render: function ColumnNarrowStory() {
    return (
      <YStack gap="$3" width={328}>
        <NavLink href="/">На главную</NavLink>
        <NavLink href="/login">Войти в аккаунт</NavLink>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
