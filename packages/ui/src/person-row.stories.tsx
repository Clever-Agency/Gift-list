import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import type { ComponentType } from "react";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { OverflowMenu } from "./overflow-menu";
import { PersonRow, type PersonRowProps, type PersonRowVariant } from "./person-row";
import { RelationshipChip } from "./relationship-chip";

const PERSON_ROW_VARIANTS = ["card", "row"] as const satisfies readonly PersonRowVariant[];

/** The ready-made photo of the sandbox; an empty value falls back to the initials. */
const PHOTO_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#7C8CFF"/><circle cx="40" cy="30" r="14" fill="#FFFEFB"/><path d="M12 80c4-20 14-30 28-30s24 10 28 30z" fill="#FFFEFB"/></svg>',
  );

/** The ready-made chip of the «есть чип» handle: the relation of the row. */
const READY_CHIP = <RelationshipChip label="Зовёт в друзья" emphasis />;

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/** The ready-made ⋮ menu of the «есть меню» handle: the person's own actions. */
function readyMenu() {
  return (
    <OverflowMenu
      label="Действия: Алёна"
      title="Алёна"
      items={[
        { key: "profile", label: "Открыть профиль", onPress: noop },
        { key: "accept", label: "Принять приглашение", onPress: noop },
        { key: "reject", label: "Отклонить", onPress: noop },
      ]}
    />
  );
}

/**
 * The person row props plus the «есть чип» and «есть меню» catalog handles. The
 * chip and the menu are node slots, so the catalog keeps a ready-made relation
 * chip and a real `OverflowMenu` behind switches instead of node knobs. The cast
 * on `component` is what lets the Docs controls see the handles; the component
 * stays unchanged.
 */
type PersonRowCatalogProps = PersonRowProps & {
  withChip: boolean;
  withMenu: boolean;
};

/**
 * The person row of Search and Friends (`DESIGN.md` → PersonRow, NFR-3): the
 * avatar, the name, `@ник` and, in a circle list, one relation chip and the ⋮
 * menu. The sandbox switches the variant and the slots, so the card and the v8
 * plain row can be compared in one place.
 */
const meta = {
  title: "UI/PersonRow",
  component: PersonRow as ComponentType<PersonRowCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The person row of Search and Friends (\`DESIGN.md\` → PersonRow, NFR-3): the avatar, the name, \`@ник\` and, in a circle list, one relation chip and the ⋮ menu.

What is not a prop:

- Wishes, email, id and the hidden flag are never part of a list answer, so they cannot appear here (NFR-3, AD-13).
- \`photoUrl\` is a URL; an empty value falls back to the initials of the name. The avatar is decorative — the name next to it carries the meaning.
- \`chip\` and \`actions\` are slots: the «есть чип» handle stands a relation chip in, «есть меню» a real \`OverflowMenu\`. The menu is a sibling of the profile link, never its child, so a press on ⋮ cannot open the profile.
- With \`href\` the row is a real \`<a href>\` on the web, so «открыть в новой вкладке» and the context menu work without the router; without it the row is plain list content.
- \`variant="row"\` is the v8 mobile list: no card chrome, the list divides the rows with a hairline.
- Hover, press and focus are CSS states, not props: hover the row, hold it, press Tab.
        `.trim(),
      },
      // The menu is a real bottom sheet: in an inline story it would paint its
      // scrim over the docs page. The page runs in iframes instead (`Dialog` did
      // the same), so an opened menu stays inside its own frame.
      story: { inline: false, iframeHeight: "420px" },
    },
  },
  argTypes: {
    displayName: propDoc({
      description: "The person's name; it is written in `body-strong` and seeds the initials avatar.",
      type: "string",
      required: true,
      control: "text",
    }),
    nick: propDoc({
      description: "The nick without the «@»; the row writes it as «@ник».",
      type: "string",
      required: true,
      control: "text",
    }),
    photoUrl: propDoc({
      description:
        "The person's photo. An empty value falls back to the initials of the name; the avatar is decorative. The sandbox starts with a ready-made sample.",
      type: "string | null",
      control: "text",
    }),
    variant: propDoc({
      description:
        "`card` (default) is the surface card of the older lists; `row` is the v8 mobile list variant — a plain row the list divides with a hairline.",
      type: formatUnionType(PERSON_ROW_VARIANTS),
      options: PERSON_ROW_VARIANTS,
      defaultValue: "card",
    }),
    chip: propDoc({
      description:
        "The relation or subscription chip on the right, e.g. `RelationshipChip`. A slot: the «есть чип» handle stands a ready-made one in.",
      type: "ReactNode",
      control: false,
    }),
    actions: propDoc({
      description:
        "The row's own controls, e.g. the ⋮ menu. They are siblings of the profile link, never its children, so a press on a control cannot open the profile. A slot: «есть меню» stands a real `OverflowMenu` in.",
      type: "ReactNode",
      control: false,
    }),
    pressLabel: propDoc({
      description:
        "The accessible name of the profile link, e.g. «Открыть профиль: Глеб, @gleb, Зовёт в друзья». The visible text is the name and `@ник` only.",
      type: "string",
      control: "text",
    }),
    href: propDoc({
      description:
        "The profile address. With it the row is a real link (`<a href>` on the web); without it the row is plain list content.",
      type: "string",
      control: "text",
    }),
    onPress: propDoc({
      description:
        "The router's press, handed over by `Link asChild`; a phone needs it because it has no anchor of its own. Not a control.",
      type: "(event?: unknown) => void",
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    withChip: {
      name: "есть чип",
      description:
        "Ручка каталога: показать в слоте `chip` готовый чип связи «Зовёт в друзья».",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    withMenu: {
      name: "есть меню",
      description:
        "Ручка каталога: показать в слоте `actions` настоящий `OverflowMenu` с действиями человека.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    displayName: "Алёна",
    nick: "alena",
    pressLabel: "Открыть профиль @alena",
    href: "/u/alena",
    onPress: noop,
    variant: "card",
    testID: "person-row",
    withChip: false,
    withMenu: false,
  },
} satisfies Meta<PersonRowCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

function PersonRowPreview({
  withChip,
  withMenu,
  chip,
  actions,
  ...rowArgs
}: PersonRowCatalogProps) {
  return (
    <YStack width={360} maxWidth="100%" backgroundColor="$surface" padding="$1">
      <PersonRow
        {...rowArgs}
        chip={withChip ? (chip ?? READY_CHIP) : chip}
        actions={withMenu ? (actions ?? readyMenu()) : actions}
      />
    </YStack>
  );
}

PersonRowPreview.displayName = "PersonRowPreview";

/**
 * The sandbox: switch `variant` between the card and the plain v8 row, write the
 * name and the nick, put a photo URL in (empty means initials), flip «есть чип»
 * and «есть меню». The ⋮ opens the real bottom sheet.
 */
export const Playground: Story = {
  args: {
    withChip: true,
    withMenu: true,
    pressLabel: "Открыть профиль: Алёна, @alena, Зовёт в друзья",
    photoUrl: PHOTO_URL,
  },
  render: function PlaygroundStory(args) {
    return <PersonRowPreview {...args} />;
  },
};

/** A circle row: the relation chip on the right and the ⋮ menu beside the link. */
export const WithChipAndMenu: Story = {
  args: {
    pressLabel: "Открыть профиль: Глеб, @gleb, Зовёт в друзья",
    displayName: "Глеб",
    nick: "gleb",
    chip: <RelationshipChip label="Зовёт в друзья" emphasis />,
    actions: (
      <OverflowMenu
        label="Действия: Глеб"
        title="Глеб"
        items={[
          { key: "profile", label: "Открыть профиль", onPress: noop },
          { key: "accept", label: "Принять приглашение", onPress: noop },
          { key: "reject", label: "Отклонить", onPress: noop },
        ]}
      />
    ),
  },
  render: function WithChipAndMenuStory(args) {
    return <PersonRowPreview {...args} />;
  },
};

/** The usual search result: a link to the profile, no chip and no menu. */
export const Link: Story = {
  tags: ["!dev"],
  render: function LinkStory(args) {
    return <PersonRowPreview {...args} />;
  },
};

/** The same card without a link, e.g. while its target is unavailable. */
export const Plain: Story = {
  tags: ["!dev"],
  args: { href: undefined, onPress: undefined, pressLabel: undefined },
  render: function PlainStory(args) {
    return <PersonRowPreview {...args} />;
  },
};

/** The subscriber row: the chip is read with the row, the menu is a sibling. */
export const SubscriberRow: Story = {
  tags: ["!dev"],
  args: {
    pressLabel: "Открыть профиль: Иван, @ivan, Взаимная подписка",
    displayName: "Иван",
    nick: "ivan",
    chip: <RelationshipChip label="Взаимная подписка" />,
    actions: (
      <OverflowMenu
        label="Действия: Иван"
        title="Иван"
        items={[
          { key: "profile", label: "Открыть профиль", onPress: noop },
          { key: "unsubscribe", label: "Отписаться", onPress: noop },
          { key: "remove", label: "Убрать подписчика", onPress: noop },
        ]}
      />
    ),
  },
  render: function SubscriberRowStory(args) {
    return <PersonRowPreview {...args} />;
  },
};

/** Long Cyrillic name and nick at 360 px: both lines stay on one line each. */
export const LongCyrillicNarrow: Story = {
  tags: ["!dev"],
  args: {
    displayName: "Александра-Екатерина Преображенская",
    nick: "alexandra_ekaterina",
    pressLabel: "Открыть профиль @alexandra_ekaterina",
  },
  render: function LongCyrillicNarrowStory(args) {
    return <PersonRowPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};

/** A long name with a chip and a menu at 360 px: the name truncates, ⋮ stays put. */
export const LongCyrillicWithMenuNarrow: Story = {
  tags: ["!dev"],
  args: {
    displayName: "Александра-Екатерина Преображенская",
    nick: "alexandra_ekaterina",
    pressLabel: "Открыть профиль: Александра-Екатерина, @alexandra_ekaterina, Друзья",
    chip: <RelationshipChip label="Друзья" />,
    actions: (
      <OverflowMenu
        label="Действия: Александра-Екатерина"
        title="Александра-Екатерина"
        items={[{ key: "profile", label: "Открыть профиль", onPress: noop }]}
      />
    ),
  },
  render: function LongCyrillicWithMenuNarrowStory(args) {
    return <PersonRowPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};

/** v8 mobile variant A: plain rows divided by hairlines, initials avatars, ⋮ on the right. */
export const DividedList: Story = {
  tags: ["!dev"],
  render: function DividedListStory() {
    const people = [
      { name: "Александра Константинопольская", nick: "alexandra_k" },
      { name: "Аня Смирнова", nick: "anya" },
      { name: "Дмитрий Ковальчук-Воскресенский", nick: "dima_kovalchuk_v" },
    ];
    return (
      <YStack role="list" width={360} maxWidth="100%">
        {people.map(function person(item, index) {
          return (
            <YStack
              key={item.nick}
              borderTopWidth={index > 0 ? 1 : 0}
              borderColor="$border"
              paddingVertical="$1"
            >
              <PersonRow
                displayName={item.name}
                nick={item.nick}
                variant="row"
                actions={
                  <OverflowMenu
                    label={`Действия: ${item.name}`}
                    title={item.name}
                    items={[{ key: "profile", label: "Открыть профиль", onPress: noop }]}
                  />
                }
              />
            </YStack>
          );
        })}
      </YStack>
    );
  },
};

/** A row with a photo instead of the initials: a ready-made sample behind the field. */
export const WithPhoto: Story = {
  tags: ["!dev"],
  args: { photoUrl: PHOTO_URL },
  render: function WithPhotoStory(args) {
    return <PersonRowPreview {...args} />;
  },
};
