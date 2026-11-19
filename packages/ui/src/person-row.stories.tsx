import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { OverflowMenu } from "./overflow-menu";
import { PersonRow } from "./person-row";
import { RelationshipChip } from "./relationship-chip";

/**
 * The person row of Search and Friends (`DESIGN.md` → PersonRow, NFR-3): the avatar,
 * the name, `@ник` and, in a circle list, one relation chip and the ⋮ menu. Wishes,
 * email, id and the hidden flag are never part of a list answer, so they cannot
 * appear here. With `href` the row is a real link to the profile (`<a href>` on the
 * web); without it the row is plain list content. `variant="row"` is the v8 mobile
 * list: no card chrome, the list divides the rows with a hairline.
 */
const meta = {
  title: "UI/PersonRow",
  component: PersonRow,
  args: {
    displayName: "Алёна",
    nick: "alena",
    pressLabel: "Открыть профиль @alena",
    href: "/u/alena",
    onPress: noop,
  },
} satisfies Meta<typeof PersonRow>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** The usual search result: a link to the profile, no chip and no menu. */
export const Link: Story = {};

/** The same card without a link, e.g. while its target is unavailable. */
export const Plain: Story = {
  args: { href: undefined, onPress: undefined, pressLabel: undefined },
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
};

/** The subscriber row: the chip is read with the row, the menu is a sibling. */
export const SubscriberRow: Story = {
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
};

/** Long Cyrillic name and nick at 360 px: both lines stay on one line each. */
export const LongCyrillicNarrow: Story = {
  args: {
    displayName: "Александра-Екатерина Преображенская",
    nick: "alexandra_ekaterina",
    pressLabel: "Открыть профиль @alexandra_ekaterina",
  },
  globals: { viewport: { value: "w360" } },
};

/** A long name with a chip and a menu at 360 px: the name truncates, ⋮ stays put. */
export const LongCyrillicWithMenuNarrow: Story = {
  args: {
    displayName: "Александра-Екатерина Преображенская",
    nick: "alexandra_ekaterina",
    pressLabel: "Открыть профиль: Александра-Екатерина, @alexandra_ekaterina, Друзья",
    chip: <RelationshipChip label="Друзья" />,
    actions: <OverflowMenu label="Действия: Александра-Екатерина" title="Александра-Екатерина" items={[{ key: "profile", label: "Открыть профиль", onPress: noop }]} />,
  },
  globals: { viewport: { value: "w360" } },
};

/** v8 mobile variant A: plain rows divided by hairlines, initials avatars, ⋮ on the right. */
export const DividedList: Story = {
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

/** A row with a photo instead of the initials. */
export const WithPhoto: Story = {
  args: {
    photoUrl:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#7C8CFF"/><circle cx="40" cy="30" r="14" fill="#FFFEFB"/><path d="M12 80c4-20 14-30 28-30s24 10 28 30z" fill="#FFFEFB"/></svg>',
      ),
  },
};
