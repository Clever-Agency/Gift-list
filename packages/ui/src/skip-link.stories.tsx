import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { propDoc } from "../../../.storybook/argTypes";
import { SkipLink } from "./skip-link";
import { Text } from "./text";

/**
 * The first stop of the Tab order (`DESIGN.md` → Порядок Tab): a link to
 * `main#main-content` that stays invisible until it takes focus. A phone draws
 * nothing. Focus is a real state and is not faked: press Tab in the sandbox.
 */
const meta = {
  title: "UI/SkipLink",
  component: SkipLink,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The first stop of the keyboard order (\`DESIGN.md\` → Порядок Tab, \`EXPERIENCE.md\` → Доступность). The link is invisible and ignores the pointer until it takes focus, then it shows a \`surface\` pill over the page and jumps to \`#main-content\` — the \`main\` landmark \`AppShell\` draws with \`tabIndex={-1}\`.

What is not a prop:

- Focus is a real DOM state, not a prop: the catalog does not paint it with styles. Press Tab in the sandbox, or open the «Focused by Tab» frame below, where the story focuses the link for you.
- A phone has no skip link: the short path to the content does not exist there, so \`skip-link.native.tsx\` draws nothing.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description:
        "The visible text of the pill and its accessible name: `web.skipToContent` — «Перейти к содержимому». Comes from the caller.",
      type: "string",
      required: true,
      control: "text",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    label: "Перейти к содержимому",
    testID: "skip",
  },
} satisfies Meta<typeof SkipLink>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: the link is invisible until the keyboard reaches it — press Tab
 * once and the pill appears in the top-left corner of the frame. Change `label`
 * in the panel to see the pill grow; it is still hidden until Tab.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return (
      <YStack width={360} height={180} padding="$4" gap="$2" backgroundColor="$background">
        <SkipLink {...args} />
        <Text kind="body-strong">Содержимое страницы</Text>
        <Text kind="body-sm" tone="muted">
          Нажмите Tab: ссылка «{args.label}» появится в левом верхнем углу и станет
          первым пунктом порядка.
        </Text>
      </YStack>
    );
  },
};

/** Press Tab: the first stop is the skip link, then the page content. */
export const FocusedByTab: Story = {
  render: function FocusedByTabStory(args) {
    return (
      <YStack height={180} padding="$4" gap="$2" backgroundColor="$background">
        <SkipLink {...args} testID="skip" />
        <Text kind="body-strong">Содержимое страницы</Text>
        <Text kind="body-sm" tone="muted">
          Ссылка «{args.label}» появляется, когда на неё попадает фокус: нажмите Tab.
        </Text>
      </YStack>
    );
  },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLAnchorElement>("a")?.focus();
  },
};

/** Without focus the link stays invisible: the page looks as if it were not there. */
export const Resting: Story = {
  tags: ["!dev"],
  render: function RestingStory(args) {
    return (
      <YStack height={120} padding="$4" gap="$2" backgroundColor="$background">
        <SkipLink {...args} />
        <Text kind="body-sm" tone="muted">
          Без фокуса ссылки не видно — она ждёт первого Tab.
        </Text>
      </YStack>
    );
  },
};
