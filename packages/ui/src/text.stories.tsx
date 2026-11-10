import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { Heading, LinkText, Text } from "./text";
import type { TypographyRole } from "./tokens";

/**
 * `Text` takes a `kind` from the typography roles of `DESIGN.md` and a `tone`
 * from the palette; `Heading` adds the screen-reader level, `LinkText` is the
 * «Назад» / navigation link. Hover and focus are real CSS states: hover the link
 * and press Tab to see the focus ring.
 */
const meta = {
  title: "UI/Text",
  component: Text,
  args: {
    children: "Плед из шерсти мериноса",
    kind: "body",
    tone: "default",
  },
} satisfies Meta<typeof Text>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** Every role, at its own size, in the default foreground colour. */
function RolesStory() {
  const roles: TypographyRole[] = [
    "display",
    "display-sm",
    "heading",
    "body-strong",
    "body",
    "button",
    "label",
    "caption",
  ];
  return (
    <YStack gap="$2" width={480} maxWidth="100%">
      {roles.map(function renderRole(role) {
        return (
          <YStack key={role} gap="$0.5">
            <Text kind="caption" tone="muted">
              {role}
            </Text>
            <Text kind={role}>Съешь ещё этих мягких французских булок</Text>
          </YStack>
        );
      })}
    </YStack>
  );
}

RolesStory.displayName = "RolesStory";

export const Roles: Story = {
  render: RolesStory,
};

/** `tone` carries meaning: muted for secondary facts, destructive for errors, reserved for a booking. */
export const Tones: Story = {
  render: function TonesStory() {
    return (
      <YStack gap="$2" width={360} maxWidth="100%">
        <Text tone="default">default — название желания</Text>
        <Text tone="muted">muted — «Добавлено 12 октября»</Text>
        <Text tone="primary">primary — ссылка «Назад»</Text>
        <Text tone="destructive">destructive — «Название не может быть пустым»</Text>
        <Text tone="reserved">reserved — «Бронирует до 4 ноября»</Text>
        <YStack backgroundColor="$primary" padding="$2" borderRadius="$sm">
          <Text tone="inverse">inverse — текст на primary</Text>
        </YStack>
      </YStack>
    );
  },
};

/** `Heading` is a real heading role with an explicit level: 1 for the screen, 2 for sections and layers. */
export const Headings: Story = {
  render: function HeadingsStory() {
    return (
      <YStack gap="$3" width={480} maxWidth="100%">
        <Heading level={1} kind="display">
          Мой вишлист
        </Heading>
        <Heading level={2} kind="display-sm">
          Получено (2)
        </Heading>
        <Heading level={2}>Недавние вишлисты</Heading>
        <Heading level={3} kind="body-strong">
          Теги желания
        </Heading>
        <Heading level={4} kind="label">
          Видимость
        </Heading>
      </YStack>
    );
  },
};

/** `LinkText` is the router link text: 44 px tall, primary, focus ring on Tab, pointer cursor on hover. */
export const Link: Story = {
  render: function LinkStory() {
    return (
      <YStack gap="$2" width={360} maxWidth="100%">
        <LinkText onPress={noop}>Назад</LinkText>
        <LinkText onPress={noop}>Скопировать ссылку на вишлист</LinkText>
      </YStack>
    );
  },
};

/** A 120-character title from the form limit and a 24-character handle, at the narrow width. */
export const LongCyrillicText: Story = {
  render: function LongCyrillicTextStory() {
    return (
      <YStack gap="$3" width={360 - 32}>
        <Text kind="body-strong" numberOfLines={2}>
          Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров у камина
        </Text>
        <Text kind="caption" tone="muted">
          @очень_длинный_ник_пользователя
        </Text>
        <Text>
          Мягкий, тёплый, подходит для чтения в кресле. Не линяет после стирки, не скатывается и
          не электризуется.
        </Text>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
