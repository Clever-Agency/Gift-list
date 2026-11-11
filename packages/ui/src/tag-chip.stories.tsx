import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { Text } from "./text";
import { TagChip, TagChipList } from "./tag-chip";

/**
 * `TagChip` is both the tag-picker control (a checkbox per catalogue tag, a chip
 * with a cross for the owner's tag) and the static tag of a gift card. Hover,
 * press and focus are CSS states: hover a chip, hold it, press Tab.
 */
const meta = {
  title: "UI/TagChip",
  component: TagChip,
  args: {
    label: "мечта",
  },
} satisfies Meta<typeof TagChip>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** Unselected catalogue tags are quiet; selected ones unfill, darken and show a check. */
export const PickerRow: Story = {
  render: function PickerRowStory() {
    return (
      <XStack gap="$2" flexWrap="wrap" width={360}>
        <TagChip label="мечта" />
        <TagChip label="нужно сейчас" selected />
        <TagChip label="когда-нибудь" />
      </XStack>
    );
  },
};

/** The owner's own tag: accent outline and the star before the text. */
export const CustomTag: Story = {
  args: { variant: "custom", label: "для дома" },
};

/** A custom tag with a cross: the cross is the accessible «Убрать тег …». */
export const CustomTagRemovable: Story = {
  args: {
    variant: "custom",
    label: "для дома",
    removeLabel: "Убрать тег для дома",
    onRemove: noop,
  },
};

/** A saved custom tag can be opened for editing by a press on its label. */
export const CustomTagEditable: Story = {
  args: {
    variant: "custom",
    label: "для дома",
    editLabel: "Редактировать тег для дома",
    removeLabel: "Убрать тег для дома",
    onPress: noop,
    onRemove: noop,
  },
};

/**
 * A tag-specific error (DESIGN.md → Tag picker): the accent frame of the owner's
 * tag gives way to the `destructive` one, and the message is rendered once by
 * the screen next to the row — not by the chip. Same 1 px stroke, so the chip
 * does not jump.
 */
export const TagError: Story = {
  render: function TagErrorStory() {
    return (
      <YStack gap="$2" width={360}>
        <XStack gap="$2" flexWrap="wrap">
          <TagChip
            label="пледы и покрывала"
            variant="custom"
            error={{ id: "tag-error-story", message: "Тег длиннее 30 символов" }}
            removeLabel="Убрать тег пледы и покрывала"
            onRemove={noop}
          />
          <TagChip label="мечта" />
        </XStack>
        <Text id="tag-error-story" kind="caption" tone="destructive" role="alert">
          Тег длиннее 30 символов
        </Text>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * A selected catalogue chip keeps its `muted` fill, the check and
 * `aria-checked`, and only the frame turns `destructive`; the chip next to it
 * shows the normal `border-strong` frame of a selected tag.
 */
export const SelectedTagError: Story = {
  render: function SelectedTagErrorStory() {
    return (
      <YStack gap="$2" width={360}>
        <XStack gap="$2" flexWrap="wrap">
          <TagChip label="мечта" selected />
          <TagChip
            label="нужно сейчас"
            selected
            error={{ id: "selected-tag-error-story", message: "Этого тега больше нет в каталоге" }}
          />
        </XStack>
        <Text id="selected-tag-error-story" kind="caption" tone="destructive" role="alert">
          Этого тега больше нет в каталоге
        </Text>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A saved custom tag with a duplicate-name error: the label still opens editing, the cross still removes. */
export const CustomTagEditError: Story = {
  render: function CustomTagEditErrorStory() {
    return (
      <YStack gap="$2" width={360}>
        <XStack gap="$2" flexWrap="wrap">
          <TagChip
            variant="custom"
            label="для дома"
            editLabel="Редактировать тег для дома"
            removeLabel="Убрать тег для дома"
            error={{ id: "custom-tag-edit-error-story", message: "Такой тег уже есть" }}
            onPress={noop}
            onRemove={noop}
          />
        </XStack>
        <Text id="custom-tag-edit-error-story" kind="caption" tone="destructive" role="alert">
          Такой тег уже есть
        </Text>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The «Свой тег» trigger: `role="button"`, `aria-expanded`, linked to the field it opens. */
export const CustomTagTrigger: Story = {
  args: {
    label: "Свой тег",
    role: "button",
    expanded: false,
    controls: "custom-tag-field",
  },
};

/** A gift card shows up to three tags and one «+N» for the rest. */
export const CardList: Story = {
  render: function CardListStory() {
    return (
      <YStack width={320}>
        <TagChipList
          labels={["мечта", "нужно сейчас", "для дома", "когда-нибудь", "на праздник"]}
          moreLabel={function moreLabel(count) {
            return `+${count}`;
          }}
          moreAccessibilityLabel={function moreAccessibilityLabel(count, hidden) {
            return `Ещё ${count} тега: ${hidden.join(", ")}`;
          }}
        />
      </YStack>
    );
  },
};

/** Long Cyrillic labels wrap inside the chips and the row does not overflow at 360 px. */
export const LongLabelsNarrow: Story = {
  render: function LongLabelsNarrowStory() {
    return (
      <YStack width={328} gap="$3">
        <TagChip
          variant="custom"
          label="пледы и покрывала для холодных вечеров"
          removeLabel="Убрать тег пледы и покрывала для холодных вечеров"
          onRemove={noop}
        />
        <TagChipList
          labels={["мечта", "очень длинный собственный тег владельца", "когда-нибудь"]}
          moreLabel={function moreLabel(count) {
            return `+${count}`;
          }}
        />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
