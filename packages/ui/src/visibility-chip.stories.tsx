import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import type { ComponentType } from "react";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import {
  VisibilityChip,
  visibilityChipColors,
  type VisibilityChipProps,
  type VisibilityTone,
} from "./visibility-chip";

const VISIBILITY_TONES = ["public", "friends", "secret"] as const satisfies readonly VisibilityTone[];

/**
 * The component props plus the two catalog handles. The cast on `component`
 * below is what lets the Docs controls and the story args see the handles: the
 * catalog plays them out into real props, the component itself stays unchanged.
 */
type ChipCatalogProps = VisibilityChipProps & { interactive: boolean; withIcon: boolean };

/**
 * `VisibilityChip` shows who sees a wish: the word carries the meaning, the icon
 * and the tone support it. The icon is drawn by the app with its own icon set, so
 * the catalog stands a neutral placeholder in for it — the «есть иконка» handle.
 *
 * The sandbox turns `tone`, `label` and `accessibilityLabel` in the panel; the
 * «интерактивный» handle adds the press behaviour of the owner's own wish.
 */
const meta = {
  title: "UI/VisibilityChip",
  component: VisibilityChip as ComponentType<ChipCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
Who sees a wish: «Всем» / «Друзьям» / «Секрет». The word is the meaning; the tone adds the plate (\`public\` — surface, \`friends\` — muted, \`secret\` — a dashed frame) and the text colour.

What is not a prop:

- The icon (globe / users / lock) is drawn by the app with its own icon set. It is decorative: the label is the accessible name. The catalog shows a neutral placeholder through the «есть иконка» handle, not a control over the node itself.
- Without \`onPress\` the chip only shows the value and lets a press through to the card underneath. With it the chip is a button (\`aria-haspopup="dialog"\`): the visual stays 28 px tall and the touch zone grows to 44 px with a transparent wrapper.
- Hover, press and focus are CSS states, not props: hover the chip, hold it, press Tab.
        `.trim(),
      },
    },
  },
  argTypes: {
    tone: propDoc({
      description:
        "The visibility: `public` — «Всем» on the `surface` plate, `friends` — «Друзьям» on `muted`, `secret` — «Секрет» with a dashed frame. The shape differs too, not only the colour.",
      type: formatUnionType(VISIBILITY_TONES),
      options: VISIBILITY_TONES,
      required: true,
      defaultValue: "public",
    }),
    label: propDoc({
      description:
        "The visible word («Всем» / «Друзьям» / «Секрет»); it is also the accessible name of the button unless `accessibilityLabel` says more.",
      type: "string",
      required: true,
      control: "text",
    }),
    icon: propDoc({
      description:
        "The globe / users / lock icon, a `ReactNode` drawn by the app and coloured with `visibilityChipColors`. Decorative. The catalog shows a placeholder through the «есть иконка» handle.",
      type: "ReactNode",
      control: false,
    }),
    onPress: propDoc({
      description:
        "Turns the chip into a button that opens the visibility layer. Not a control; the «интерактивный» handle stands a `noop` in.",
      type: "() => void",
      control: false,
    }),
    accessibilityLabel: propDoc({
      description:
        "The name of the button when the word is not enough, e.g. «Видимость: всем. Изменить». Used only with `onPress`.",
      type: "string",
      control: "text",
    }),
    interactive: {
      name: "интерактивный",
      description:
        "Ручка каталога: добавить `onPress` с пустой функцией, чтобы чип был кнопкой с зоной 44 px.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    withIcon: {
      name: "есть иконка",
      description: "Ручка каталога: показать слот `icon` с готовым образцом в цвете тона.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
  },
  args: {
    tone: "public",
    label: "Всем",
    accessibilityLabel: "Видимость: всем. Изменить",
    interactive: false,
    withIcon: true,
  },
} satisfies Meta<ChipCatalogProps>;

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

/**
 * The chip with the two catalog handles applied: the placeholder icon of the
 * tone, and the press behaviour of the button form. The stories differ only in
 * their args, so the frame is written once.
 */
function ChipPreview({ interactive, withIcon, onPress, tone, ...rest }: ChipCatalogProps) {
  return (
    <VisibilityChip
      {...rest}
      tone={tone}
      icon={withIcon ? <ToneIcon tone={tone} /> : undefined}
      onPress={interactive ? noop : onPress}
    />
  );
}

ChipPreview.displayName = "ChipPreview";

/**
 * The sandbox: pick the tone and type the word; the placeholder icon follows the
 * tone. Turn «интерактивный» on to get the button form with its 44 px zone and
 * the «Видимость: …» name — then press Tab to see the focus ring.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <ChipPreview {...args} />;
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
    return <ChipPreview {...args} />;
  },
};

export const Public: Story = {
  tags: ["!dev"],
  render: function PublicStory(args) {
    return <ChipPreview {...args} />;
  },
};

export const Friends: Story = {
  tags: ["!dev"],
  args: { tone: "friends", label: "Друзьям" },
  render: function FriendsStory(args) {
    return <ChipPreview {...args} />;
  },
};

/** Secret is a dashed outline: the shape differs, not only the colour. */
export const Secret: Story = {
  tags: ["!dev"],
  args: { tone: "secret", label: "Секрет" },
  render: function SecretStory(args) {
    return <ChipPreview {...args} />;
  },
};

export const AllTones: Story = {
  tags: ["!dev"],
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
  tags: ["!dev"],
  args: {
    tone: "friends",
    label: "Только друзьям, кроме подписчиков",
    onPress: noop,
    accessibilityLabel: "Видимость: только друзьям, кроме подписчиков. Изменить",
  },
  render: function LongLabelNarrowStory(args) {
    return <ChipPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};
