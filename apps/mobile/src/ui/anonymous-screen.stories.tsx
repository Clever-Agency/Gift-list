import type { Meta, StoryObj } from "@storybook/react";
import { Text, YStack } from "@gift-list/ui";
import { AnonymousScreen } from "./anonymous-screen";
import { NavLink } from "./nav-link";
import { PrimaryButton } from "./primary-button";
import { TextField } from "./text-field";

/**
 * The frame of the anonymous screens: the brand heading, the footer and the page
 * scroll around whatever the screen passes. The brand comes from the configuration
 * (`EXPO_PUBLIC_BRAND_NAME`, AD-24); the catalog mocks that module and shows
 * «Gift List».
 */
const meta = {
  title: "App/AnonymousScreen",
  component: AnonymousScreen,
  parameters: { layout: "fullscreen" },
  args: { title: "Вход" },
} satisfies Meta<typeof AnonymousScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** A title only: the invite and other stub screens use the frame as it is. */
export const TitleOnly: Story = {};

/** The sign-in screen: fields, the primary action and a link to registration. */
export const SignInForm: Story = {
  render: function SignInFormStory(args) {
    return (
      <AnonymousScreen {...args}>
        <YStack gap="$grid-gap">
          <TextField label="Email" value="" onChangeText={noop} />
          <TextField label="Пароль" value="" onChangeText={noop} />
          <PrimaryButton label="Войти" onPress={noop} />
          <NavLink href="/register">Зарегистрироваться</NavLink>
        </YStack>
      </AnonymousScreen>
    );
  },
};

/** A long title at 360 px: the heading wraps, the footer stays at the bottom. */
export const LongTitleNarrow: Story = {
  args: { title: "Сброс пароля для аккаунта Gift List" },
  render: function LongTitleNarrowStory(args) {
    return (
      <AnonymousScreen {...args}>
        <YStack gap="$grid-gap">
          <Text tone="muted">
            Введите email, и мы пришлём ссылку для нового пароля. Письмо приходит в течение
            нескольких минут.
          </Text>
          <TextField label="Email" value="" onChangeText={noop} />
          <PrimaryButton label="Отправить письмо" onPress={noop} />
        </YStack>
      </AnonymousScreen>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** Two anonymous screens share one frame: the page column keeps `max-form`. */
export const WideWindow: Story = {
  render: function WideWindowStory(args) {
    return (
      <AnonymousScreen {...args}>
        <YStack gap="$grid-gap">
          <TextField label="Email" value="" onChangeText={noop} />
          <PrimaryButton label="Войти" onPress={noop} />
        </YStack>
      </AnonymousScreen>
    );
  },
  globals: { viewport: { value: "w768" } },
};
