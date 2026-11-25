import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { propDoc } from "../../../.storybook/argTypes";
import { OverflowMenu, type OverflowMenuItem } from "./overflow-menu";
import { PersonRow } from "./person-row";
import { RelationshipChip } from "./relationship-chip";
import { Text } from "./text";

function noop() {}

const items: OverflowMenuItem[] = [
  { key: "profile", label: "Открыть профиль", onPress: noop },
  { key: "cancel", label: "Отменить приглашение", onPress: noop },
  { key: "unsubscribe", label: "Отписаться", onPress: noop },
  { key: "block", label: "Заблокировать", onPress: noop, destructive: true },
];

/**
 * `DESIGN.md` → PersonRow / Мелкие элементы: the vertical ⋮ trigger is 44 × 44 and
 * opens the `{components.user-menu}` bottom sheet with the person's name in the
 * heading. Destructive items are red and stay last, after the divider.
 *
 * The sandbox is live: the menu opens with the real ⋮ trigger and closes with Esc,
 * a scrim press or a pick. The list of actions is the ready-made set of the row.
 */
const meta = {
  title: "UI/OverflowMenu",
  component: OverflowMenu,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The ⋮ menu of a person row (\`DESIGN.md\` → PersonRow / Мелкие элементы): a 44 × 44 trigger and the \`{components.user-menu}\` bottom sheet with the person's name in the heading.

What is not a prop:

- The list of actions is a ready-made set in the sandbox; the component orders it itself, so destructive items always go last, after one divider.
- The trigger is a sibling of the profile link, never its child: a press on ⋮ must not open the profile. \`forwardRef\` reaches the trigger, so a screen can put focus back on it after an action.
- The glyph is only the visible mark; the accessible name of the trigger is \`label\`, e.g. «Действия: Алёна».
- The layer is \`BottomSheet\`: Esc, a scrim press and a pick close it, and a phone shows the same sheet with the system «назад».
        `.trim(),
      },
      // The opened menu is a real bottom sheet: inline it would paint its scrim
      // over the description and the neighbouring stories. Every showcase of this
      // page runs in its own iframe instead (`Dialog` did the same).
      story: { inline: false, iframeHeight: "420px" },
    },
  },
  argTypes: {
    label: propDoc({
      description:
        "The accessible name of the trigger, e.g. «Действия: Алёна» (`EXPERIENCE.md` → подпись ⋮ для диктора). The visible glyph is only the ellipsis.",
      type: "string",
      required: true,
      control: "text",
    }),
    title: propDoc({
      description: "The heading of the opened layer, e.g. the person's name.",
      type: "string",
      required: true,
      control: "text",
    }),
    items: propDoc({
      description:
        "The rows of the menu. The sandbox keeps a ready-made set; destructive items are red and stay last, whatever order the caller passes.",
      type: "OverflowMenuItem[]",
      required: true,
      control: false,
    }),
    glyph: propDoc({
      description:
        "The visible glyph of the trigger; the vertical `⋮` by default (`DESIGN.md` → v8).",
      type: "string",
      control: "text",
      defaultValue: "⋮",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    label: "Действия: Алёна",
    title: "Алёна",
    items,
    glyph: "⋮",
    testID: "overflow-menu",
  },
} satisfies Meta<typeof OverflowMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: change the trigger name, the heading and the glyph, then press the
 * real ⋮ to open the sheet. The menu is live — Esc, the scrim and a pick close it.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return (
      <YStack width={360} maxWidth="100%" padding="$2" backgroundColor="$surface">
        <OverflowMenu {...args} />
      </YStack>
    );
  },
};

/** The full person row the menu belongs to: the card is the link, ⋮ is a sibling. */
export const InPersonRow: Story = {
  render: function InPersonRowStory() {
    return (
      <YStack gap="$2" width={360} maxWidth="100%">
        <PersonRow
          displayName="Алёна"
          nick="alena"
          chip={<RelationshipChip label="Зовёт в друзья" emphasis />}
          actions={<OverflowMenu label="Действия: Алёна" title="Алёна" items={items} />}
          href="/u/alena"
          pressLabel="Открыть профиль: Алёна, @alena, Зовёт в друзья"
        />
        <Text kind="caption" tone="muted">
          Press ⋮ to open the menu; the card itself is the profile link.
        </Text>
      </YStack>
    );
  },
};

/** The trigger alone: the catalog story opens the real menu with a press. */
export const Trigger: Story = {
  tags: ["!dev"],
  render: function TriggerStory(args) {
    return (
      <YStack width={360} maxWidth="100%" padding="$2" backgroundColor="$surface">
        <OverflowMenu {...args} />
      </YStack>
    );
  },
};

/** A closed menu with its real trigger: press ⋮ in the story to open it. */
export const ClosedWithTrigger: Story = {
  tags: ["!dev"],
  render: function ClosedWithTriggerStory() {
    return (
      <OverflowMenu
        label="Действия: Алёна"
        title="Алёна"
        items={items}
        testID="overflow-menu-closed"
      />
    );
  },
};

/** Long Cyrillic name and a destructive item at 360 px: the sheet keeps the gutter. */
export const LongContentNarrow: Story = {
  tags: ["!dev"],
  render: function LongContentNarrowStory() {
    return (
      <YStack gap="$2" alignItems="flex-start">
        <OverflowMenu
          label="Действия: Александра-Екатерина Преображенская"
          title="Александра-Екатерина Преображенская"
          items={[
            { key: "profile", label: "Открыть профиль", onPress: noop },
            { key: "cancel", label: "Отменить приглашение", onPress: noop },
            {
              key: "block",
              label: "Заблокировать Александра-Екатерину",
              onPress: noop,
              destructive: true,
            },
          ]}
        />
        <Text kind="caption" tone="muted">
          Press ⋮ to open the menu.
        </Text>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
