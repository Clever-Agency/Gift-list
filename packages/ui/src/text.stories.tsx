import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { Heading, LinkText, Text } from "./text";
import type { TypographyRole } from "./tokens";

const TEXT_KINDS = [
  "display",
  "display-sm",
  "heading",
  "body-strong",
  "body",
  "body-sm",
  "button",
  "label",
  "caption",
] as const satisfies readonly TypographyRole[];

const TEXT_TONES = ["default", "muted", "primary", "destructive", "reserved", "inverse"] as const;

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * `Text` takes a `kind` from the typography roles of `DESIGN.md` and a `tone`
 * from the palette; `Heading` adds the screen-reader level, `LinkText` is the
 * «Назад» / navigation link. The sandbox turns `kind` and `tone` in the panel.
 */
const meta = {
  title: "UI/Text",
  component: Text,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The text of both apps (\`DESIGN.md\` → Типографика): every size, line height, weight and letter spacing comes from the typography tokens, and every colour from the palette. \`Heading\` is the same text with a real heading role and level; \`LinkText\` is the «Назад» / navigation link.

What is not a prop:

- \`kind\` is the typography role: Lora for \`display\`, \`display-sm\` and \`heading\`, Manrope for the UI roles. There is no separate font or size prop.
- \`tone\` carries meaning: \`muted\` for secondary facts, \`destructive\` for errors, \`reserved\` for a booking, \`inverse\` only on \`primary\`. Colour alone never has to carry the meaning, so the copy says it too.
- \`Heading\` draws no new look: it sets \`role="heading"\` and \`aria-level\` (1 for the page title, 2 for sections and layers) on the same text.
- Hover, press and focus of \`LinkText\` are real CSS states: the \`$muted\` fill on hover (160 ms, instant with «уменьшить движение»), the \`opacity: 0.9\` press and the \`$ring\` ring on \`:focus-visible\` only (a mouse click leaves no ring; a phone paints the same ring on \`focus\`).
        `.trim(),
      },
    },
  },
  argTypes: {
    children: propDoc({
      description: "The copy itself. It comes from the caller; the package has no translations.",
      type: "ReactNode",
      required: true,
      control: "text",
    }),
    kind: propDoc({
      description:
        "The typography role: `display` and `display-sm` are the Lora page titles, `heading` a Lora section title; `body-strong`, `body`, `body-sm`, `button`, `label` and `caption` are Manrope. The size, line height, weight and letter spacing follow the role.",
      type: formatUnionType(TEXT_KINDS),
      options: TEXT_KINDS,
      defaultValue: "body",
    }),
    tone: propDoc({
      description:
        "The colour: `default` foreground, `muted` for secondary facts, `primary` for a link or the current item, `destructive` for an error, `reserved` for a booking, `inverse` for text on the `primary` fill.",
      type: formatUnionType(TEXT_TONES),
      options: TEXT_TONES,
      defaultValue: "default",
    }),
  },
  args: {
    children: "Плед из шерсти мериноса",
    kind: "body",
    tone: "default",
  },
} satisfies Meta<typeof Text>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: write the copy and turn `kind` and `tone` in the panel. The text
 * keeps its role and colour tokens, so the toolbar theme repaints it too.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return (
      <YStack width={360} maxWidth="100%">
        <Text {...args} />
      </YStack>
    );
  },
};

/**
 * `LinkText` is the router link text: 44 px tall, primary, `$muted` on hover,
 * dimmed on press, focus ring on Tab. In the app the text sits inside a router
 * `<a>` (`NavLink`), which is what Tab reaches; the standalone span here takes
 * `tabIndex` and `role="link"` in the story only, so the same `:focus-visible`
 * ring is reachable and visible in the catalog (W12.9-4).
 */
export const Link: Story = {
  render: function LinkStory() {
    return (
      <YStack gap="$2" width={360} maxWidth="100%">
        <LinkText tabIndex={0} role="link" onPress={noop}>
          Назад
        </LinkText>
        <LinkText tabIndex={0} role="link" onPress={noop}>
          Скопировать ссылку на вишлист
        </LinkText>
      </YStack>
    );
  },
};

/** Every role, at its own size, in the default foreground colour. */
function RolesStory() {
  const roles = TEXT_KINDS;
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
  tags: ["!dev"],
  render: RolesStory,
};

/** `tone` carries meaning: muted for secondary facts, destructive for errors, reserved for a booking. */
export const Tones: Story = {
  tags: ["!dev"],
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
  tags: ["!dev"],
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

/** A 120-character title from the form limit and a 24-character handle, at the narrow width. */
export const LongCyrillicText: Story = {
  tags: ["!dev"],
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
