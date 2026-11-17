import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import { VisibilityChip, visibilityChipColors, type VisibilityTone } from "./visibility-chip";

/**
 * `VisibilityChip` shows who sees a wish: the word carries the meaning, the icon
 * and the tone support it. The icon is drawn by the app with its own icon set, so
 * the catalog stands a neutral placeholder in for it.
 */
const meta = {
  title: "UI/VisibilityChip",
  component: VisibilityChip,
  args: {
    tone: "public",
    label: "Всем",
  },
} satisfies Meta<typeof VisibilityChip>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** A placeholder for the app's globe / users / lock icon, in the tone's colour. */
function ToneIcon({ tone }: { tone: VisibilityTone }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx={8} cy={8} r={6} fill="none" stroke={visibilityChipColors[tone]} strokeWidth={1.5} />
      <path d="M2 8h12" stroke={visibilityChipColors[tone]} strokeWidth={1.5} />
    </svg>
  );
}

ToneIcon.displayName = "ToneIcon";

export const Public: Story = {
  args: { tone: "public", label: "Всем" },
  render: function PublicStory(args) {
    return <VisibilityChip {...args} icon={<ToneIcon tone="public" />} />;
  },
};

export const Friends: Story = {
  args: { tone: "friends", label: "Друзьям" },
  render: function FriendsStory(args) {
    return <VisibilityChip {...args} icon={<ToneIcon tone="friends" />} />;
  },
};

/** Secret is a dashed outline: the shape differs, not only the colour. */
export const Secret: Story = {
  args: { tone: "secret", label: "Секрет" },
  render: function SecretStory(args) {
    return <VisibilityChip {...args} icon={<ToneIcon tone="secret" />} />;
  },
};

/** The owner's open wish: the chip is a button that opens the visibility layer. */
export const Interactive: Story = {
  args: {
    tone: "public",
    label: "Всем",
    accessibilityLabel: "Видимость: всем. Изменить",
    onPress: noop,
  },
  render: function InteractiveStory(args) {
    return <VisibilityChip {...args} icon={<ToneIcon tone="public" />} />;
  },
};

export const AllTones: Story = {
  render: function AllTonesStory() {
    return (
      <XStack gap="$3" flexWrap="wrap" width={360}>
        <VisibilityChip tone="public" label="Всем" icon={<ToneIcon tone="public" />} />
        <VisibilityChip tone="friends" label="Друзьям" icon={<ToneIcon tone="friends" />} />
        <VisibilityChip tone="secret" label="Секрет" icon={<ToneIcon tone="secret" />} />
      </XStack>
    );
  },
};

/** A long visibility phrase at 360 px, inside the 44 px touch wrapper. */
export const LongLabelNarrow: Story = {
  args: {
    tone: "friends",
    label: "Только друзьям, кроме подписчиков",
    onPress: noop,
    accessibilityLabel: "Видимость: только друзьям, кроме подписчиков. Изменить",
  },
  render: function LongLabelNarrowStory(args) {
    return <VisibilityChip {...args} icon={<ToneIcon tone="friends" />} />;
  },
  globals: { viewport: { value: "w360" } },
};
