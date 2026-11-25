import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import type { ComponentType } from "react";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { Avatar } from "./avatar";
import type { AvatarProps, AvatarSize, AvatarStatus } from "./avatar.types";
import { Text } from "./text";

const AVATAR_SIZES = ["sm", "md", "lg"] as const satisfies readonly AvatarSize[];
const AVATAR_STATUSES = ["online", "busy", "offline"] as const satisfies readonly AvatarStatus[];

/**
 * The component props plus the two catalog handles. The cast on `component`
 * below is what lets the Docs controls and the story args see the handles: the
 * catalog plays them out into real props, the component itself stays unchanged.
 */
type AvatarCatalogProps = AvatarProps & { withPhoto: boolean; withStatus: boolean };

/**
 * The avatar of v8: a photo or the initials on `muted`, three sizes from the spacing
 * tokens, and an optional status dot. The status word is passed translated and goes
 * into the accessible name — colour alone never carries the meaning.
 *
 * The sandbox turns the public props in the panel; the photo and the status are
 * behind the «есть фото» and «есть статус» handles, so no file picker appears.
 */

/** A local photo stand-in: the catalog builds offline, so no network image is used. */
const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C8CFF"/><stop offset="1" stop-color="#B4A7E0"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/><circle cx="80" cy="62" r="26" fill="#FFFEFB" opacity=".9"/><path d="M30 160c6-38 26-56 50-56s44 18 50 56z" fill="#FFFEFB" opacity=".9"/></svg>',
  );

const meta = {
  title: "UI/Avatar",
  component: Avatar as ComponentType<AvatarCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The round avatar of v8 (\`DESIGN.md\` → Avatar): a photo or the initials of the name on \`muted\`, three sizes from the spacing tokens (28 / 40 / 64), and an optional status dot on the lower edge.

What is not a prop:

- The status word is passed translated (\`statusLabel\`) and goes into the accessible name — «Анна Ковалёва, в сети». The dot alone is colour, so it never carries the meaning.
- \`decorative\` hides the avatar from screen readers when the name is written next to it, so the name is not read twice.
- The circle never grows: a long name only changes the initials it shows.
- The photo is a URL string; the catalog shows a local stand-in through the «есть фото» handle and has no file picker.
        `.trim(),
      },
    },
  },
  argTypes: {
    name: propDoc({
      description:
        "The person's name: the accessible name (with `statusLabel`) and the source of the initials.",
      type: "string",
      required: true,
      control: "text",
    }),
    photoUrl: propDoc({
      description:
        "The photo, a URL string. Without it (or when it fails to load) the initials stay in. The «есть фото» handle stands a local sample image in.",
      type: "string | null",
      control: false,
    }),
    size: propDoc({
      description:
        "`sm` — 28 px (a list row), `md` — 40 px (a person row), `lg` — 64 px (a profile). The dot follows the size.",
      type: formatUnionType(AVATAR_SIZES),
      options: AVATAR_SIZES,
      defaultValue: "md",
    }),
    status: propDoc({
      description:
        "A dot on the lower edge: `online` — в сети, `busy` — занят, `offline` — не в сети. Used together with `statusLabel`; the «есть статус» handle shows it.",
      type: formatUnionType(AVATAR_STATUSES),
      options: AVATAR_STATUSES,
    }),
    statusLabel: propDoc({
      description:
        "The translated word for the status, e.g. «в сети»: the dot alone is colour, so the meaning goes into the accessible name.",
      type: "string",
      control: "text",
    }),
    decorative: propDoc({
      description:
        "The avatar is a picture of the person next to their written name: hide it from screen readers (`aria-hidden`) so the name is not read twice.",
      type: "boolean",
      defaultValue: "false",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    withPhoto: {
      name: "есть фото",
      description:
        "Ручка каталога: подставить готовое локальное изображение в `photoUrl` вместо инициалов.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    withStatus: {
      name: "есть статус",
      description:
        "Ручка каталога: показать точку статуса и подпись из `status` / `statusLabel`.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    name: "Анна Ковалёва",
    size: "md",
    status: "online",
    statusLabel: "в сети",
    decorative: false,
    testID: "avatar",
    withPhoto: false,
    withStatus: false,
  },
} satisfies Meta<AvatarCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The avatar with the two catalog handles applied: the photo and the status dot. */
function AvatarPreview({ withPhoto, withStatus, ...avatarArgs }: AvatarCatalogProps) {
  return (
    <Avatar
      {...avatarArgs}
      photoUrl={withPhoto ? PHOTO : undefined}
      status={withStatus ? avatarArgs.status : undefined}
      statusLabel={withStatus ? avatarArgs.statusLabel : undefined}
    />
  );
}

AvatarPreview.displayName = "AvatarPreview";

/**
 * The sandbox: change the name, the size and `decorative` in the panel; the
 * photo and the status dot are behind their handles. `decorative` leaves no
 * visible change — it only removes the avatar from the accessible tree.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <AvatarPreview {...args} />;
  },
};

/** Next to a written name the avatar is decorative (`decorative`), so the name is read once. */
export const BesideName: Story = {
  render: function AvatarBesideNameStory() {
    return (
      <XStack gap="$2" alignItems="center" width={320}>
        <Avatar name="Анна Ковалёва" size="md" decorative />
        <YStack flex={1} minWidth={0}>
          <Text kind="body-strong" numberOfLines={1}>
            Анна Ковалёва
          </Text>
          <Text kind="caption" tone="muted" numberOfLines={1}>
            @anna
          </Text>
        </YStack>
      </XStack>
    );
  },
};

/** No photo: the initials of the name on the muted plate. */
export const Initials: Story = {
  tags: ["!dev"],
  render: function InitialsStory(args) {
    return <AvatarPreview {...args} />;
  },
};

export const Photo: Story = {
  tags: ["!dev"],
  args: { withPhoto: true },
  render: function PhotoStory(args) {
    return <AvatarPreview {...args} />;
  },
};

/** All three sizes: 28 / 40 / 64 (`avatar-sm` / `avatar-md` / `avatar-lg`). */
export const Sizes: Story = {
  tags: ["!dev"],
  render: function AvatarSizesStory() {
    return (
      <XStack gap="$4" alignItems="center">
        <YStack gap="$1" alignItems="center">
          <Avatar name="Анна Ковалёва" size="sm" />
          <Text kind="caption" tone="muted">
            sm · 28
          </Text>
        </YStack>
        <YStack gap="$1" alignItems="center">
          <Avatar name="Анна Ковалёва" size="md" />
          <Text kind="caption" tone="muted">
            md · 40
          </Text>
        </YStack>
        <YStack gap="$1" alignItems="center">
          <Avatar name="Анна Ковалёва" size="lg" />
          <Text kind="caption" tone="muted">
            lg · 64
          </Text>
        </YStack>
      </XStack>
    );
  },
};

/** The status dot with its translated word; the same word is in the accessible name. */
export const Statuses: Story = {
  tags: ["!dev"],
  render: function AvatarStatusesStory() {
    const people = [
      { name: "Анна Ковалёва", status: "online", statusLabel: "в сети" },
      { name: "Михаил Соколов", status: "busy", statusLabel: "занят" },
      { name: "Ольга Ли", status: "offline", statusLabel: "не в сети" },
    ] as const;
    return (
      <XStack gap="$4" alignItems="center">
        {people.map(function person(item) {
          return (
            <YStack key={item.name} gap="$1" alignItems="center" width={96}>
              <Avatar name={item.name} status={item.status} statusLabel={item.statusLabel} size="lg" />
              <Text kind="caption" tone="muted" textAlign="center">
                {item.statusLabel}
              </Text>
            </YStack>
          );
        })}
      </XStack>
    );
  },
};

/** A long Cyrillic name and the longest status word at 360 px: the circle never grows. */
export const LongNameNarrow: Story = {
  tags: ["!dev"],
  args: {
    name: "Александра-Мария Константинопольская",
    withStatus: true,
  },
  render: function LongNameNarrowStory(args) {
    return <AvatarPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};
