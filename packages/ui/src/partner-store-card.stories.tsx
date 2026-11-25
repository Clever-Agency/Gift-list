import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import type { ComponentType } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { PartnerStoreCard, type PartnerStoreCardProps } from "./partner-store-card";

/**
 * The store card props plus the «есть обложка» and «есть логотип» catalog handles.
 * The cover and the logo are URL slots, so the catalog keeps ready-made samples
 * behind switches instead of a file picker. The cast on `component` is what lets
 * the Docs controls and the story args see the handles; the component stays unchanged.
 */
type PartnerStoreCardCatalogProps = PartnerStoreCardProps & {
  withCover: boolean;
  withLogo: boolean;
};

/** The ready-made 16:9 cover of the «есть обложка» handle. */
const COVER_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#F5DCC8"/><path d="M0 132c58-34 110 10 164-12s96-34 156-6v66H0z" fill="#D9A97C"/><circle cx="252" cy="52" r="26" fill="#FFFEFB" opacity="0.85"/><rect x="30" y="38" width="74" height="74" rx="10" fill="#FFFEFB" opacity="0.6"/></svg>',
  );

/** The ready-made logo of the «есть логотип» handle: a calm sign, not a photo. */
const LOGO_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#7C8CFF"/><path d="M48 18 58 38l22 3-16 16 4 22-20-10-20 10 4-22L16 41l22-3z" fill="#FFFEFB"/></svg>',
  );

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * The partner store card of v8 (variant C): a store cover, the logo circle on its
 * bottom edge, the name, the category and a quiet promo chip. No text sits on the
 * photo; without a cover the store's monogram stands on a calm tint. The rail
 * (`UI/PartnerStoreRail`) is the only horizontal slider of the design.
 *
 * The sandbox turns the strings, the monogram and the width in the panel; the
 * cover and the logo are ready-made samples behind the «есть обложка» and
 * «есть логотип» handles.
 */
const meta = {
  title: "UI/PartnerStoreCard",
  component: PartnerStoreCard as ComponentType<PartnerStoreCardCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The partner store card of v8 (variant C): the store cover, the logo circle overlapping its bottom edge, the name, the category and the promo chip. Text never sits on the photo.

What is not a prop:

- The cover and the logo are URL slots: the «есть обложка» and «есть логотип» handles stand ready-made samples in, and without them the card draws the monogram in the circle and on the plate.
- The monogram is the letters of the logo circle and of the cover placeholder, e.g. «СЛ».
- The promo is never red and never gold: it is the calm accent chip.
- With \`onPress\` the whole card is a button of at least 44 px, named by \`pressLabel\`; without it the card is plain list content.
- Hover, press and focus are CSS states, not props: hover the card, hold it, press Tab.
        `.trim(),
      },
    },
  },
  argTypes: {
    name: propDoc({
      description: "The store name, one line with an ellipsis.",
      type: "string",
      required: true,
      control: "text",
    }),
    category: propDoc({
      description: "The category line, e.g. «дом и уют».",
      type: "string",
      required: true,
      control: "text",
    }),
    promo: propDoc({
      description:
        "The promo chip, e.g. «−15% по промокоду»; an empty value hides it and the card keeps one line fewer. Never red, never gold.",
      type: "string | null",
      control: "text",
    }),
    coverUrl: propDoc({
      description:
        "The 16:9 store cover. Without it a tinted plate with the monogram stands in. The «есть обложка» handle supplies a ready-made sample.",
      type: "string | null",
      control: false,
    }),
    logoUrl: propDoc({
      description:
        "The store logo. Without it the monogram stands in the accent circle. The «есть логотип» handle supplies a ready-made sample.",
      type: "string | null",
      control: false,
    }),
    monogram: propDoc({
      description:
        "The letters of the logo circle and of the cover placeholder, e.g. «СЛ».",
      type: "string",
      required: true,
      control: "text",
    }),
    width: propDoc({
      description:
        "The card width: a number of pixels or a CSS size. The rail slides cards of one width.",
      type: "number | string",
      control: "number",
      defaultValue: "200",
    }),
    onPress: propDoc({
      description:
        "Opens the store. With it the whole card is a button, named by `pressLabel`. Not a control: the sandbox always stands a `noop` in.",
      type: "() => void",
      control: false,
    }),
    pressLabel: propDoc({
      description:
        "The accessible name of the card button, e.g. «Северная лавка, дом и уют, −15% по промокоду».",
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
        "Ручка каталога: показать `coverUrl` с готовым образцом обложки. Выключено — заглушка с монограммой.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    withLogo: {
      name: "есть логотип",
      description:
        "Ручка каталога: показать `logoUrl` с готовым образцом логотипа. Выключено — монограмма в круге.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    name: "Северная лавка",
    category: "дом и уют",
    promo: "−15% по промокоду",
    monogram: "СЛ",
    width: 200,
    pressLabel: "Северная лавка, дом и уют, −15% по промокоду",
    testID: "partner-store-card",
    withCover: false,
    withLogo: false,
  },
} satisfies Meta<PartnerStoreCardCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

function PartnerStoreCardPreview({
  withCover,
  withLogo,
  coverUrl,
  logoUrl,
  ...cardArgs
}: PartnerStoreCardCatalogProps) {
  return (
    <XStack width={360} maxWidth="100%">
      <PartnerStoreCard
        {...cardArgs}
        coverUrl={withCover ? (coverUrl ?? COVER_URL) : undefined}
        logoUrl={withLogo ? (logoUrl ?? LOGO_URL) : undefined}
      />
    </XStack>
  );
}

PartnerStoreCardPreview.displayName = "PartnerStoreCardPreview";

/**
 * The sandbox: write the name, the category, the promo and the monogram, change
 * the width, flip «есть обложка» and «есть логотип». The card is pressable here,
 * so hover and press are live.
 */
export const Playground: Story = {
  args: {
    withCover: true,
    withLogo: true,
    onPress: noop,
  },
  render: function PlaygroundStory(args) {
    return <PartnerStoreCardPreview {...args} />;
  },
};

/** Without a cover and a logo: the monogram stands on the plate and in the circle. */
export const Default: Story = {
  tags: ["!dev"],
  render: function DefaultStory(args) {
    return <PartnerStoreCardPreview {...args} />;
  },
};

/** Without a promo: the card keeps the same height, only one line fewer. */
export const WithoutPromo: Story = {
  tags: ["!dev"],
  args: { promo: null },
  render: function WithoutPromoStory(args) {
    return <PartnerStoreCardPreview {...args} />;
  },
};

/** A promotional store with a longer name and category at 360 px. */
export const LongTextNarrow: Story = {
  tags: ["!dev"],
  args: {
    name: "Книжный ковчег на Петроградской стороне",
    category: "книги, канцелярия, настольные игры",
    promo: "−10% новичкам по промокоду ПЕРВАЯКНИГА",
    monogram: "КК",
    width: 160,
  },
  render: function LongTextNarrowStory(args) {
    return <PartnerStoreCardPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};

/** A pressable store: the whole card is the button, the name is its label. */
export const Pressable: Story = {
  args: {
    onPress: noop,
    pressLabel: "Северная лавка, дом и уют, −15% по промокоду",
  },
  render: function PressableStory(args) {
    return <PartnerStoreCardPreview {...args} />;
  },
};

/** A real cover and logo: the photo fills the plate and the sign the circle. */
export const WithCoverAndLogo: Story = {
  tags: ["!dev"],
  args: { withCover: true, withLogo: true },
  render: function WithCoverAndLogoStory(args) {
    return <PartnerStoreCardPreview {...args} />;
  },
};

/** The set the rail slides: one width, one gap, placeholders with monograms. */
export const Rail: Story = {
  tags: ["!dev"],
  render: function RailStory() {
    const stores = [
      { name: "Северная лавка", category: "дом и уют", promo: "−15% по промокоду", monogram: "СЛ" },
      { name: "Пиксель", category: "техника и гаджеты", promo: "кешбэк 7%", monogram: "ПК" },
      { name: "Книжный ковчег", category: "книги", promo: null, monogram: "КК" },
      { name: "Кофейный двор", category: "кофе и чай", promo: "−20% на зёрна", monogram: "КД" },
    ];
    return (
      <XStack gap={14}>
        {stores.map(function store(item) {
          return (
            <PartnerStoreCard
              key={item.name}
              name={item.name}
              category={item.category}
              promo={item.promo}
              monogram={item.monogram}
              width={200}
            />
          );
        })}
      </XStack>
    );
  },
};
