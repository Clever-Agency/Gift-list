import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { useId, type ComponentType } from "react";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { TagChip, TagChipList, type TagChipProps, type TagChipRole, type TagChipVariant } from "./tag-chip";
import { Text } from "./text";

const TAG_CHIP_VARIANTS = ["picker", "card", "custom"] as const satisfies readonly TagChipVariant[];
const TAG_CHIP_ROLES = ["checkbox", "button"] as const satisfies readonly TagChipRole[];

/** The catalogue fixture of the per-chip error; the message is rendered once by the screen. */
const TAG_ERROR = { id: "tag-chip-catalog-error", message: "Такой тег уже есть" };

/**
 * The component props plus the three catalog handles. The cast on `component`
 * below is what lets the Docs controls and the story args see the handles: the
 * catalog plays them out into real props, the component itself stays unchanged.
 */
type TagChipCatalogProps = TagChipProps & {
  removable: boolean;
  editable: boolean;
  hasError: boolean;
};

/**
 * `TagChip` is both the tag-picker control (a checkbox per catalogue tag, a chip
 * with a cross for the owner's tag) and the static tag of a gift card. Hover,
 * press and focus are CSS states: hover a chip, hold it, press Tab.
 *
 * The sandbox turns the public props in the panel and keeps the slots behind
 * ready-made handles: «есть крестик», «редактируется» and «есть ошибка».
 */
const meta = {
  title: "UI/TagChip",
  component: TagChip as ComponentType<TagChipCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The tag chip of the picker and the gift card. A fixed catalogue tag is a \`checkbox\` with its own state; a custom tag is a chip with a cross that removes it and, when \`onPress\` is set, a pressable label that edits it. \`variant="card"\` is the same visual without any control semantics.

What is not a prop:

- The error is an object (\`{ id, message }\`): the screen renders the message once and passes its id, so the screen reader reads the same text on the chip without a duplicate node. The «есть ошибка» handle stands a ready-made error in.
- The copy comes from the caller: fixed labels come from the server catalogue, the package never translates them.
- Hover, press and focus are CSS states, not props: hover a chip, hold it, press Tab.
- A long custom label wraps inside its chip instead of overflowing; the 44 px touch target stays.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description: "The visible text and the accessible name of the toggle or the chip.",
      type: "string",
      required: true,
      control: "text",
    }),
    variant: propDoc({
      description:
        "`picker` — the form control: a fixed tag is a checkbox, a custom one a chip with a cross. `card` — a static label on a gift card, not a control. `custom` — the owner's own tag: accent outline and the star before the text.",
      type: formatUnionType(TAG_CHIP_VARIANTS),
      options: TAG_CHIP_VARIANTS,
      defaultValue: "picker",
    }),
    selected: propDoc({
      description:
        "For a fixed tag: selected chips take the violet `accent` fill, the `accent-border` frame, the check and `aria-checked`.",
      type: "boolean",
      defaultValue: "false",
    }),
    onPress: propDoc({
      description:
        "Toggles the fixed tag, opens the custom-tag field, or opens a custom tag for editing. Not a control; the «редактируется» handle stands a `noop` in.",
      type: "() => void",
      control: false,
    }),
    role: propDoc({
      description:
        "`button` for the «Свой тег» trigger; `checkbox` (default) for a fixed tag. Only the trigger uses `expanded` and `controls`.",
      type: formatUnionType(TAG_CHIP_ROLES),
      options: TAG_CHIP_ROLES,
      defaultValue: "checkbox",
    }),
    expanded: propDoc({
      description: "For the «Свой тег» trigger: whether the custom-tag field is open (`aria-expanded`).",
      type: "boolean",
    }),
    controls: propDoc({
      description: "For the trigger: the id of the field it opens (`aria-controls`).",
      type: "string",
      control: "text",
    }),
    removeLabel: propDoc({
      description:
        "The accessible name of the cross, e.g. «Убрать тег мечта». A chip with a cross is a removable custom tag: its label is text, not a checkbox.",
      type: "string",
      control: "text",
    }),
    onRemove: propDoc({
      description:
        "Removes the custom tag. Not a control; the «есть крестик» handle stands a `noop` in.",
      type: "() => void",
      control: false,
    }),
    editLabel: propDoc({
      description:
        "The accessible name of the pressable label on a removable custom tag, e.g. «Редактировать тег мечта».",
      type: "string",
      control: "text",
    }),
    accessibilityLabel: propDoc({
      description:
        "The accessible name when the visible text is not enough: the «+N» card chip names the tags it hides, a live draft keeps its purpose. Defaults to `label`.",
      type: "string",
      control: "text",
    }),
    error: propDoc({
      description:
        "An item-specific validation error from the screen: the chip is outlined in `$destructive`, marked invalid and described by the message rendered once by the caller. Ignored by a static card chip. The «есть ошибка» handle stands a ready-made error in.",
      type: "{ id: string; message: string }",
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    removable: {
      name: "есть крестик",
      description:
        "Ручка каталога: показать слот `onRemove` с пустой функцией, чтобы у чипа был крестик с подписью «Убрать тег …».",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    editable: {
      name: "редактируется",
      description:
        "Ручка каталога: добавить `onPress` с пустой функцией — метка чипа открывает свой тег на редактирование.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    hasError: {
      name: "есть ошибка",
      description:
        "Ручка каталога: показать слот `error` с готовым образцом и сообщением под чипом.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    label: "для дома",
    variant: "custom",
    selected: false,
    role: "checkbox",
    removeLabel: "Убрать тег для дома",
    editLabel: "Редактировать тег для дома",
    testID: "tag-chip",
    removable: true,
    editable: false,
    hasError: false,
  },
} satisfies Meta<TagChipCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/**
 * The chip with the three catalog handles applied. The error message is drawn
 * once under the chip, as a screen does it — the chip itself only takes the id,
 * and the id is unique per render so two samples on the Docs page do not clash.
 */
function ChipPreview({
  removable,
  editable,
  hasError,
  onPress,
  label,
  ...rest
}: TagChipCatalogProps) {
  const errorId = useId();
  const error = hasError ? { ...TAG_ERROR, id: errorId } : undefined;
  return (
    <YStack gap="$2" width={360} alignItems="flex-start">
      <TagChip
        {...rest}
        label={label}
        error={error}
        onRemove={removable ? noop : undefined}
        onPress={editable ? noop : onPress}
      />
      {error ? (
        <Text id={error.id} kind="caption" tone="destructive" role="alert">
          {error.message}
        </Text>
      ) : null}
    </YStack>
  );
}

ChipPreview.displayName = "ChipPreview";

/**
 * The sandbox: change the variant, the label and the state in the panel. The
 * cross, the editable label and the error are behind the handles, so the slots
 * stay simple switches instead of node knobs.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <ChipPreview {...args} />;
  },
};

/** A custom tag with a cross: the cross is the accessible «Убрать тег …». */
export const CustomTagRemovable: Story = {
  args: {
    variant: "custom",
    label: "для дома",
    removeLabel: "Убрать тег для дома",
    onRemove: noop,
  },
  render: function CustomTagRemovableStory(args) {
    return <ChipPreview {...args} />;
  },
};

/** Unselected catalogue tags are quiet; selected ones unfill, darken and show a check. */
export const PickerRow: Story = {
  tags: ["!dev"],
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
  tags: ["!dev"],
  args: {
    variant: "custom",
    label: "для дома",
    removable: false,
  },
  render: function CustomTagStory(args) {
    return <ChipPreview {...args} />;
  },
};

/** A saved custom tag can be opened for editing by a press on its label. */
export const CustomTagEditable: Story = {
  tags: ["!dev"],
  args: {
    variant: "custom",
    label: "для дома",
    editLabel: "Редактировать тег для дома",
    removeLabel: "Убрать тег для дома",
    editable: true,
  },
  render: function CustomTagEditableStory(args) {
    return <ChipPreview {...args} />;
  },
};

/**
 * A tag-specific error (DESIGN.md → Tag picker): the accent border of the owner's
 * tag gives way to the `destructive` one, and the message is rendered once by
 * the screen next to the row — not by the chip. Same 1 px stroke, so the chip
 * does not jump.
 */
export const TagError: Story = {
  tags: ["!dev"],
  args: {
    variant: "custom",
    label: "пледы и покрывала",
    removeLabel: "Убрать тег пледы и покрывала",
    hasError: true,
  },
  render: function TagErrorStory(args) {
    return <ChipPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * A selected catalogue chip takes the violet `accent` fill, the `accent-border`
 * frame, the check and `aria-checked`; only the frame turns `destructive` when the
 * tag has an error, and the chip next to it shows the same selected frame without it.
 */
export const SelectedTagError: Story = {
  tags: ["!dev"],
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
  tags: ["!dev"],
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
  tags: ["!dev"],
  args: {
    label: "Свой тег",
    variant: "picker",
    role: "button",
    expanded: false,
    controls: "custom-tag-field",
    removable: false,
  },
  render: function CustomTagTriggerStory(args) {
    return <ChipPreview {...args} />;
  },
};

/** A gift card shows up to three tags and one «+N» for the rest. */
export const CardList: Story = {
  tags: ["!dev"],
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
  tags: ["!dev"],
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
