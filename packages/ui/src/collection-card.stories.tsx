import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import type { ComponentType } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { CollectionCard, type CollectionCardProps } from "./collection-card";

/**
 * The collection card props plus the «есть обложка» catalog handle. The cover is a
 * URL slot, so the catalog keeps one ready-made sample behind a switch instead of
 * a file picker. The cast on `component` is what lets the Docs controls and the
 * story args see the handle; the component itself stays unchanged.
 */
type CollectionCardCatalogProps = CollectionCardProps & { withCover: boolean };

/** The ready-made 3:4 cover of the «есть обложка» handle. */
const COVER_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#C9B8FF"/><circle cx="150" cy="150" r="68" fill="#FFFEFB" opacity="0.72"/><path d="M0 318h300v82H0z" fill="#7C8CFF" opacity="0.55"/><circle cx="230" cy="80" r="18" fill="#FFFEFB" opacity="0.6"/></svg>',
  );

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * The editorial collection card of v8 (variant A): a tall 3:4 cover with the card
 * shadow, and the title and idea count below it on the page background — never on
 * the photo. Without a cover the plate stays a calm tint with the moon mark.
 *
 * The sandbox turns the title, the count and the width in the panel and keeps the
 * cover behind the «есть обложка» handle; the card is pressable there, so hover
 * and press can be watched live.
 */
const meta = {
  title: "UI/CollectionCard",
  component: CollectionCard as ComponentType<CollectionCardCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The editorial collection card of v8 (variant A): the 3:4 cover, the title and the line of ideas below it. Text always stands on the page background, never on the photo.

What is not a prop:

- The cover is a URL: the «есть обложка» handle stands a ready-made sample in, and without it the card draws the tinted plate with the moon mark.
- The count is already pluralised by the caller: the package never translates «24 идеи».
- With \`onPress\` the whole card is a button of at least 44 px, with the accessible name from \`pressLabel\`; without it the card is plain list content.
- Hover, press and focus are CSS states, not props: hover the card, hold it, press Tab.
        `.trim(),
      },
    },
  },
  argTypes: {
    title: propDoc({
      description:
        "The editorial title, one line with an ellipsis. It is also the seed of the cover placeholder, so the same collection always gets the same tint.",
      type: "string",
      required: true,
      control: "text",
    }),
    count: propDoc({
      description: "The idea count line, already pluralised by the caller, e.g. «24 идеи».",
      type: "string",
      required: true,
      control: "text",
    }),
    coverUrl: propDoc({
      description:
        "The 3:4 cover photo. Without it the plate keeps a calm tint and the moon mark. The «есть обложка» handle stands a ready-made sample in.",
      type: "string | null",
      control: false,
    }),
    width: propDoc({
      description:
        "The card width: a number of pixels or a CSS size. The rail and the grid of the app pass one width to every card of a row.",
      type: "number | string",
      control: "number",
      defaultValue: "150",
    }),
    onPress: propDoc({
      description:
        "Opens the collection. With it the whole card is a button, with the name from `pressLabel`. Not a control: the sandbox always stands a `noop` in.",
      type: "() => void",
      control: false,
    }),
    pressLabel: propDoc({
      description:
        "The accessible name of the card button, e.g. «На Новый год, 24 идеи». The visible text is the title and the count only.",
      type: "string",
      control: "text",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    withCover: {
      name: "есть обложка",
      description:
        "Ручка каталога: показать `coverUrl` с готовым образцом обложки. Выключено — штатная заглушка компонента.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    title: "На Новый год",
    count: "24 идеи",
    width: 150,
    pressLabel: "На Новый год, 24 идеи",
    testID: "collection-card",
    withCover: false,
  },
} satisfies Meta<CollectionCardCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

function CollectionCardPreview({ withCover, coverUrl, ...cardArgs }: CollectionCardCatalogProps) {
  return (
    <XStack width={360} maxWidth="100%">
      <CollectionCard {...cardArgs} coverUrl={withCover ? (coverUrl ?? COVER_URL) : undefined} />
    </XStack>
  );
}

CollectionCardPreview.displayName = "CollectionCardPreview";

/**
 * The sandbox: write the title and the count, change the width, flip
 * «есть обложка». The card is pressable here, so hover and press are live.
 */
export const Playground: Story = {
  args: {
    withCover: true,
    onPress: noop,
    pressLabel: "На Новый год, 24 идеи",
  },
  render: function PlaygroundStory(args) {
    return <CollectionCardPreview {...args} />;
  },
};

/** The row the section draws: 3:4 covers of one width and one gap. */
export const Row: Story = {
  render: function RowStory() {
    const collections = [
      { title: "На Новый год", count: "24 идеи" },
      { title: "Осенние тренды", count: "18 идей" },
      { title: "Женские штучки", count: "30 идей" },
      { title: "До 3 000 ₽", count: "40 идей" },
    ];
    return (
      <XStack gap={14}>
        {collections.map(function collection(item) {
          return (
            <CollectionCard key={item.title} title={item.title} count={item.count} width={150} />
          );
        })}
      </XStack>
    );
  },
};

/** Without a cover: the tinted plate with the moon mark, seeded by the title. */
export const Default: Story = {
  tags: ["!dev"],
  render: function DefaultStory(args) {
    return <CollectionCardPreview {...args} />;
  },
};

/** A pressable collection: the whole card opens it. */
export const Pressable: Story = {
  tags: ["!dev"],
  args: { onPress: noop, pressLabel: "На Новый год, 24 идеи" },
  render: function PressableStory(args) {
    return <CollectionCardPreview {...args} />;
  },
};

/** A long title clamps to one line; the count keeps its own line. */
export const LongTitle: Story = {
  tags: ["!dev"],
  args: { title: "Подарки для тех, кто всё уже купил и не знает, чего хочет", count: "128 идей" },
  render: function LongTitleStory(args) {
    return <CollectionCardPreview {...args} />;
  },
};

/** A real cover: the photo fills the 3:4 plate and the card shadow lifts on hover. */
export const WithCover: Story = {
  tags: ["!dev"],
  args: { withCover: true },
  render: function WithCoverStory(args) {
    return <CollectionCardPreview {...args} />;
  },
};

/** At 360 px two cards fit with the page gutter and the third peeks in. */
export const Narrow: Story = {
  tags: ["!dev"],
  render: function NarrowStory() {
    return (
      <XStack gap={14}>
        <CollectionCard title="На Новый год" count="24 идеи" width={150} />
        <CollectionCard title="Осенние тренды" count="18 идей" width={150} />
        <CollectionCard title="Женские штучки" count="30 идей" width={150} />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
