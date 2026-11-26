import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import type { ComponentType, ReactNode } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { Button } from "./button";
import { Pressable } from "./pressable";
import { WishCardSkeleton } from "./skeleton";
import { StatusPill } from "./status-pill";
import { Switch } from "./switch";
import { TagChipList } from "./tag-chip";
import { LinkText, Text } from "./text";
import { WishCard, type WishCardProps } from "./wish-card";

/**
 * The wish card props plus the «есть теги» and «есть меню» catalog handles. The
 * slots are nodes, so the catalog keeps ready-made samples behind switches instead
 * of node knobs. The cast on `component` is what lets the Docs controls see the
 * handles; the component itself stays unchanged.
 */
type WishCardCatalogProps = Omit<WishCardProps, "status"> & {
  status?: ReactNode;
  withTags: boolean;
  withMenu: boolean;
  withFooter: boolean;
};

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/** The ready-made tag row of the «есть теги» handle. */
const READY_TAGS = (
  <TagChipList
    labels={["мечта", "для дома"]}
    moreLabel={function moreLabel(count) {
      return `+${count}`;
    }}
  />
);

/** The action block the app puts in the `footer` of a reservation card. */
const READY_FOOTER = (
  <YStack gap="$2">
    <Switch label="Купил" checked={false} onChange={noop} />
    <Button variant="outline" label="Продлить до…" onPress={noop} />
    <Text kind="label" tone="muted">
      у @anya
    </Text>
  </YStack>
);

/** The overflow trigger the app puts on an archived card: a 44 px target, a sibling of the card. */
const READY_MENU = (
  <Pressable
    aria-label="Действия: Плед из шерсти мериноса"
    onPress={noop}
    width="$touch-target"
    height="$touch-target"
    alignItems="center"
    justifyContent="center"
  >
    <Text>⋯</Text>
  </Pressable>
);

/**
 * `WishCard` is the presentational gift card of v8: a vertical Pinterest card with a
 * 4:5 photo plate (the moon placeholder until a wish has a photo), the title and the
 * price under it on the page background, then the status pill, tags and the
 * reservation line. There is no frame around the cell and no text on the photo.
 *
 * The sandbox turns the strings, the states and the width in the panel; the status,
 * tags, menu and footer are ready-made samples behind handles.
 */
const meta = {
  title: "UI/WishCard",
  component: WishCard as unknown as ComponentType<WishCardCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
\`WishCard\` is the presentational gift card of v8: a vertical Pinterest card with a 4:5 photo plate (the moon placeholder until a wish has a photo), the title and the price under it on the page background, then the status pill, tags and the reservation line. There is no frame around the cell and no text on the photo.

What is not a prop:

- There is no photo URL: a wish without a photo always draws the placeholder, and its tint is seeded by the title. A future photo prop would be a separate change.
- The app builds the status pill, the tag row and the menu; they arrive as slots. The «есть теги», «есть меню» and «есть действия» handles stand ready-made samples in.
- With \`onPress\` the whole card is a button and the plate's shadow lifts on hover of any part of it, while the title is underlined — the card is the Tamagui group.
- \`footer\` adds an action block — the buttons and the switch of a reservation card. It is a sibling of the card button too: nothing is nested, and Tab goes card first, actions next.
- D-54: the card has no visibility chip and no «who sees» control: visibility changes only in the wish form.
- \`listItem={false}\` is for an owner strip next to the card: the wrapper of the cell then carries the \`listitem\` role.
- Hover, press and focus are CSS states, not props: hover any part of the card, hold it, press Tab.
        `.trim(),
      },
    },
  },
  argTypes: {
    title: propDoc({
      description:
        "The wish title: two lines with an ellipsis. It also seeds the placeholder tint, so the same wish always looks the same.",
      type: "string",
      required: true,
      control: "text",
    }),
    closed: propDoc({
      description: "A closed wish reads as muted: the title, the price and the status line drop to `muted`.",
      type: "boolean",
      defaultValue: "false",
    }),
    price: propDoc({
      description:
        "The formatted price, e.g. «2 500 ₽». An empty value hides the line; the v8 card shows the price without a store.",
      type: "string | null",
      control: "text",
    }),
    status: propDoc({
      description:
        "The `StatusPill` of the wish. The sandbox draws «Открыт» or «Получен» for a closed card; the showcases below pass their own pill.",
      type: "ReactNode",
      required: true,
      control: false,
    }),
    tags: propDoc({
      description:
        "The tag row, e.g. the app's `TagChipList`. A slot: «есть теги» stands a ready-made row in.",
      type: "ReactNode",
      control: false,
    }),
    reservation: propDoc({
      description:
        "The reservation line, «Подписи брони» in `EXPERIENCE.md`: «Бронирует Анна до 4 ноября». A string is drawn in the reserved colour; a node is rendered as is, so the app can make the holder's name a link. The line is a sibling of the card button (CLE-129, T4.2).",
      type: "string | ReactNode",
      control: "text",
    }),
    onPress: propDoc({
      description:
        "Opens the wish. With it the whole card is a button, named by `pressLabel`, and a hover of any part of it lifts the plate's shadow and underlines the title. Not a control: the sandbox always stands a `noop` in.",
      type: "() => void",
      control: false,
    }),
    pressLabel: propDoc({
      description:
        "The accessible name of the card button, e.g. «Плед, 2 500 ₽, Открыт, мечта».",
      type: "string",
      control: "text",
    }),
    pressRef: propDoc({
      description:
        "The card button itself, so a closing detail dialog can return focus to it. A ref, not a control.",
      type: "Ref<ComponentRef<typeof Pressable>>",
      control: false,
    }),
    width: propDoc({
      description:
        "The card width in px, or a CSS size. Without it the card fills the parent — the phone grid passes `calc(50% - 8px)`.",
      type: "number | string",
      control: "number",
      defaultValue: "100%",
    }),
    menu: propDoc({
      description:
        "The owner menu, a sibling of the card button (Story 2.6 archive). The sandbox keeps a ready-made ⋮ trigger behind «есть меню».",
      type: "ReactNode",
      control: false,
    }),
    footer: propDoc({
      description:
        "The action block under the card body, a sibling of the card button: the reservation actions. The sandbox keeps ready-made switches and buttons behind «есть действия».",
      type: "ReactNode",
      control: false,
    }),
    listItem: propDoc({
      description:
        "Whether the card itself is the `listitem` of the surrounding `role=\"list\"`. Story 5.6 passes `false` when an owner strip stands next to the card.",
      type: "boolean",
      defaultValue: "true",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    withTags: {
      name: "есть теги",
      description: "Ручка каталога: показать в слоте `tags` готовую строку тегов.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    withMenu: {
      name: "есть меню",
      description:
        "Ручка каталога: показать в слоте `menu` готовый триггер ⋮, который ставит приложение на архивную карточку.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    withFooter: {
      name: "есть действия",
      description:
        "Ручка каталога: показать в слоте `footer` готовый блок действий карточки брони — переключатель и кнопку.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    title: "Плед из шерсти мериноса",
    price: "2 500 ₽",
    width: 240,
    closed: false,
    listItem: true,
    pressLabel: "Плед из шерсти мериноса, 2 500 ₽, Открыт, мечта, для дома",
    testID: "wish-card",
    withTags: true,
    withMenu: false,
    withFooter: false,
  },
} satisfies Meta<WishCardCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The grid wrapper the app paints cards in: the card itself is a `listitem`. */
function CardGrid({ children }: { children: ReactNode }) {
  return (
    <XStack role="list" flexWrap="wrap" gap="$grid-gap" width={328}>
      {children}
    </XStack>
  );
}

CardGrid.displayName = "CardGrid";

function WishCardPreview({
  withTags,
  withMenu,
  withFooter,
  tags,
  menu,
  footer,
  status,
  ...cardArgs
}: WishCardCatalogProps) {
  return (
    <WishCard
      {...cardArgs}
      status={
        status ?? (
          <StatusPill
            status={cardArgs.closed ? "closed" : "open"}
            label={cardArgs.closed ? "Получен" : "Открыт"}
          />
        )
      }
      tags={withTags ? (tags ?? READY_TAGS) : tags}
      menu={withMenu ? (menu ?? READY_MENU) : menu}
      footer={withFooter ? (footer ?? READY_FOOTER) : footer}
    />
  );
}

WishCardPreview.displayName = "WishCardPreview";

/**
 * The sandbox: write the title, the price and the reservation, flip `closed` and
 * `listItem`, change the width, and turn the status, tags and menu samples on and
 * off. The card is pressable here, so hover is live. There is no photo knob: a wish
 * without a photo always draws the placeholder.
 */
export const Playground: Story = {
  args: {
    onPress: noop,
    pressLabel: "Плед из шерсти мериноса, 2 500 ₽, Открыт, мечта, для дома",
    reservation: null,
    withMenu: true,
  },
  render: function PlaygroundStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} />
      </CardGrid>
    );
  },
};

/**
 * Hover of the whole card (browser only): the pointer may sit on the title, the
 * price, the tags or the empty footer — the plate lifts `$shadow-card-hover` and
 * the title is underlined, both with the `quick` transition. There is no `$muted`
 * fill over the card and no scale. The state is live, not faked with styles.
 */
export const Hover: Story = {
  tags: ["!dev"],
  args: {
    onPress: noop,
    pressLabel: "Плед из шерсти мериноса, 2 500 ₽, Открыт, мечта, для дома",
    reservation: null,
    withMenu: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Наведите указатель на любую часть карточки — название, цену, теги или пустое место под ними: плитка поднимает тень `$shadow-card-hover`, название подчёркивается, переход `quick` 160 мс. Заливки `$muted` на всей карточке и увеличения нет. Состояние живое: стилями оно не подделано.",
      },
    },
  },
  render: function HoverStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} />
      </CardGrid>
    );
  },
};

/** The owner's card with the menu trigger in the top-right corner (Story 2.6). */
export const WithMenu: Story = {
  args: { menu: READY_MENU },
  render: function WithMenuStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/**
 * The `footer` slot: the actions of a reservation card stand under the body. They
 * are siblings of the card button, so Tab goes card first, actions next; the plate
 * still lifts its shadow on hover of the card itself.
 */
export const WithFooter: Story = {
  tags: ["!dev"],
  args: { withFooter: true, withMenu: true },
  render: function WithFooterStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** A plain open wish: the photo placeholder, the title, the price, the status and the tags. */
export const Open: Story = {
  tags: ["!dev"],
  render: function OpenStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** No photo yet: the v8 placeholder — a calm tinted plate with the moon, no text. */
export const NoPhotoPlaceholder: Story = {
  tags: ["!dev"],
  render: function NoPhotoPlaceholderStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
        <WishCardPreview {...args} title="Настольная лампа" width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** A booked wish shows the reservation line in the reserved colour. */
export const Reserved: Story = {
  tags: ["!dev"],
  args: {
    status: <StatusPill status="reserved" label="Забронирован" />,
    reservation: "Бронирует Анна до 4 ноября",
  },
  render: function ReservedStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/**
 * The holder shared their name: it is a link to `/u/{nick}` and sits next to the
 * card button, never inside it (CLE-129, T4.2). The long name wraps at 360 px.
 */
export const ReservedHolderLink: Story = {
  tags: ["!dev"],
  args: {
    status: <StatusPill status="reserved" label="Забронирован" />,
    reservation: (
      <XStack gap="$1" alignItems="center" flexWrap="wrap">
        <Text kind="label" tone="reserved">
          Берёт
        </Text>
        <LinkText>Анна Константиновна Преображенская</LinkText>
      </XStack>
    ),
  },
  render: function ReservedHolderLinkStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A closed wish reads as muted all the way down; its status is «Получен». */
export const Closed: Story = {
  tags: ["!dev"],
  args: {
    closed: true,
    reservation: null,
  },
  render: function ClosedStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** Without a price: «Необязательная цена» — the card simply has one line fewer. */
export const WithoutPrice: Story = {
  tags: ["!dev"],
  args: { price: null },
  render: function WithoutPriceStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** An archived wish: muted (`closed`), read-only, only the menu stays active. */
export const ArchivedWithMenu: Story = {
  tags: ["!dev"],
  args: {
    closed: true,
    status: <StatusPill status="open" label="В архиве" />,
    reservation: null,
    menu: READY_MENU,
  },
  render: function ArchivedWithMenuStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** Long Cyrillic title at 360 px: the menu trigger does not push the text sideways. */
export const ArchivedLongTitleNarrow: Story = {
  tags: ["!dev"],
  args: {
    closed: true,
    title: "Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров у камина",
    menu: READY_MENU,
  },
  render: function ArchivedLongTitleNarrowStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A 120-character title clamps to two lines at 360 px; the card does not grow sideways. */
export const LongTitleNarrow: Story = {
  tags: ["!dev"],
  args: {
    title:
      "Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров у камина зимой",
    tags: (
      <TagChipList
        labels={["мечта", "очень длинный собственный тег владельца", "для дома", "на праздник"]}
        moreLabel={function moreLabel(count) {
          return `+${count}`;
        }}
      />
    ),
  },
  render: function LongTitleNarrowStory(args) {
    return (
      <CardGrid>
        <WishCardPreview {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The loading state has the same shape as the card: plate, two lines, chip footer. */
export const LoadingSkeleton: Story = {
  tags: ["!dev"],
  render: function LoadingSkeletonStory() {
    return (
      <CardGrid>
        <WishCardSkeleton width="calc(50% - 8px)" />
        <WishCardSkeleton width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** Two columns at 360 px, the width the phone grid uses (`cardGrid`). */
export const PhoneGrid: Story = {
  tags: ["!dev"],
  render: function PhoneGridStory(args) {
    const cards = [
      { key: "open", status: <StatusPill status="open" label="Открыт" /> },
      { key: "reserved", status: <StatusPill status="reserved" label="Забронирован" /> },
    ];
    return (
      <CardGrid>
        {cards.map(function card(item) {
          return (
            <WishCardPreview
              key={item.key}
              {...args}
              title={item.key === "open" ? "Плед из шерсти мериноса" : "Керамическая кружка"}
              status={item.status}
              width="calc(50% - 8px)"
            />
          );
        })}
      </CardGrid>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** Three columns from the `medium` breakpoint (a desktop window). */
export const DesktopGrid: Story = {
  tags: ["!dev"],
  render: function DesktopGridStory(args) {
    return (
      <YStack role="list" flexDirection="row" flexWrap="wrap" gap="$grid-gap" width={1072}>
        <WishCardPreview {...args} width="calc(33.333% - 11px)" />
        <WishCardPreview {...args} title="Керамическая кружка" width="calc(33.333% - 11px)" />
        <WishCardPreview {...args} title="Настольная лампа" width="calc(33.333% - 11px)" />
      </YStack>
    );
  },
  globals: { viewport: { value: "w1280" } },
};
