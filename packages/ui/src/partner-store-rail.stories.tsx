import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType, ReactNode } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { PartnerStoreCard } from "./partner-store-card";
import { PartnerStoreRail, type PartnerStoreRailProps } from "./partner-store-rail";

/**
 * The rail props plus the «есть ссылка Все» and «есть пояснение» catalog handles.
 * The marking explanation and «Все» are callback slots, so the catalog keeps two
 * switches and one ready-made set of cards instead of node knobs. The cast on
 * `component` is what lets the Docs controls see the handles; the component stays
 * unchanged.
 */
type PartnerStoreRailCatalogProps = Omit<PartnerStoreRailProps, "children"> & {
  children?: ReactNode;
  withAllLink: boolean;
  withLabelInfo: boolean;
};

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

const STORES = [
  { name: "Северная лавка", category: "дом и уют", promo: "−15% по промокоду", monogram: "СЛ" },
  { name: "Пиксель", category: "техника и гаджеты", promo: "кешбэк 7%", monogram: "ПК" },
  { name: "Книжный ковчег", category: "книги", promo: "−10% новичкам", monogram: "КК" },
  { name: "Кофейный двор", category: "кофе и чай", promo: "−20% на зёрна", monogram: "КД" },
];

/** The ready-made cards the rail slides. */
function stores(): ReactNode {
  return STORES.map(function store(item) {
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
  });
}

/**
 * The v8 horizontal rail of the search screen (`DESIGN.md` → Partner stores): a
 * heading row with the optional ad marking and the «Все» link, then a one-row slider
 * of `PartnerStoreCard`s. This is the only horizontal wish/store pattern of the design.
 *
 * The sandbox turns the heading and the marking copy, and hides or shows «Все»
 * and the explanation of the marking; the cards are the ready-made set.
 */
const meta = {
  title: "UI/PartnerStoreRail",
  component: PartnerStoreRail as unknown as ComponentType<PartnerStoreRailCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The v8 horizontal rail of the search screen (\`DESIGN.md\` → Partner stores): a heading row with the optional ad marking («Партнёры» + info sign) and the «Все» link, then a one-row slider of \`PartnerStoreCard\`s. This is the only horizontal wish/store pattern of the design; wishes themselves are always the vertical grid.

What is not a prop:

- The heading, the marking, «Все» and every card come from the caller. The sandbox keeps one ready-made set of cards.
- The marking chip is static text without \`onLabelPress\`; with it the chip becomes a button named by \`labelInfo\`, so the explanation of the marking is reachable.
- «Все» is drawn only when both \`allLabel\` and \`onAllPress\` are set; the catalog keeps both behind «есть ссылка Все».
- The slider is the shared scroll view, so the next card peeks in at 360 px and the page gutter stays.
        `.trim(),
      },
    },
  },
  argTypes: {
    title: propDoc({
      description: "The heading of the rail, e.g. «Магазины-партнёры».",
      type: "string",
      required: true,
      control: "text",
    }),
    label: propDoc({
      description: "The ad marking chip, e.g. «Партнёры»; hidden when omitted.",
      type: "string",
      control: "text",
    }),
    labelInfo: propDoc({
      description:
        "The accessible explanation of the marking. Used with `onLabelPress`: without the callback the chip is static text.",
      type: "string",
      control: "text",
    }),
    onLabelPress: propDoc({
      description:
        "Opens the explanation of the marking. Not a control: «есть пояснение» stands a `noop` in, and then the chip becomes a button.",
      type: "() => void",
      control: false,
    }),
    allLabel: propDoc({
      description:
        "The «Все» link of the heading row. Drawn only together with `onAllPress`; «есть ссылка Все» supplies both.",
      type: "string",
      control: "text",
    }),
    onAllPress: propDoc({
      description:
        "Opens the screen of every store. Not a control: «есть ссылка Все» stands a `noop` in.",
      type: "() => void",
      control: false,
    }),
    children: propDoc({
      description:
        "`PartnerStoreCard`s; the rail is the only horizontal slider of the design. The sandbox passes its ready-made set.",
      type: "ReactNode",
      required: true,
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    withAllLink: {
      name: "есть ссылка Все",
      description:
        "Ручка каталога: показать `allLabel` и `onAllPress` — ссылка «Все» открывает экран всех магазинов.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    withLabelInfo: {
      name: "есть пояснение",
      description:
        "Ручка каталога: добавить `onLabelPress` — метка «Партнёры» становится кнопкой с пояснением из `labelInfo`.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    title: "Магазины-партнёры",
    label: "Партнёры",
    labelInfo: "WishMoon получает вознаграждение за покупки по этим ссылкам",
    allLabel: "Все",
    testID: "partner-store-rail",
    withAllLink: false,
    withLabelInfo: false,
  },
} satisfies Meta<PartnerStoreRailCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

function PartnerStoreRailPreview({
  withAllLink,
  withLabelInfo,
  allLabel,
  labelInfo,
  onAllPress,
  onLabelPress,
  children,
  ...railArgs
}: PartnerStoreRailCatalogProps) {
  return (
    <PartnerStoreRail
      {...railArgs}
      allLabel={withAllLink ? (allLabel ?? "Все") : allLabel}
      onAllPress={withAllLink ? (onAllPress ?? noop) : onAllPress}
      labelInfo={withLabelInfo ? (labelInfo ?? "Пояснение к метке") : labelInfo}
      onLabelPress={withLabelInfo ? (onLabelPress ?? noop) : onLabelPress}
    >
      {children ?? stores()}
    </PartnerStoreRail>
  );
}

PartnerStoreRailPreview.displayName = "PartnerStoreRailPreview";

/**
 * The sandbox: write the heading and the marking, flip «есть ссылка Все» and
 * «есть пояснение». The cards are the ready-made set the rail slides.
 */
export const Playground: Story = {
  args: { withAllLink: true, withLabelInfo: true },
  render: function PlaygroundStory(args) {
    return <PartnerStoreRailPreview {...args} />;
  },
};

/** The marking opens its explanation; «Все» opens the screen of every store. */
export const WithActions: Story = {
  args: { onLabelPress: noop, onAllPress: noop },
  render: function WithActionsStory(args) {
    return <PartnerStoreRailPreview {...args} />;
  },
};

/** The static marking chip: «Партнёры» without an explanation and without «Все». */
export const Default: Story = {
  tags: ["!dev"],
  render: function DefaultStory(args) {
    return <PartnerStoreRailPreview {...args} />;
  },
};

/** Without the marking and «Все»: the same rail, just the heading and the cards. */
export const TitleOnly: Story = {
  tags: ["!dev"],
  args: { label: undefined, labelInfo: undefined, allLabel: undefined },
  render: function TitleOnlyStory(args) {
    return <PartnerStoreRailPreview {...args} />;
  },
};

/** At 360 px the rail keeps the page gutter and the next card still peeks in. */
export const Narrow: Story = {
  tags: ["!dev"],
  args: { onLabelPress: noop, onAllPress: noop },
  render: function NarrowStory(args) {
    return <PartnerStoreRailPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};
