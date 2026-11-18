import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { Avatar } from "./avatar";
import { Text } from "./text";

/**
 * The avatar of v8: a photo or the initials on `muted`, three sizes from the spacing
 * tokens, and an optional status dot. The status word is passed translated and goes
 * into the accessible name — colour alone never carries the meaning.
 */

/** A local photo stand-in: the catalog builds offline, so no network image is used. */
const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C8CFF"/><stop offset="1" stop-color="#B4A7E0"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/><circle cx="80" cy="62" r="26" fill="#FFFEFB" opacity=".9"/><path d="M30 160c6-38 26-56 50-56s44 18 50 56z" fill="#FFFEFB" opacity=".9"/></svg>',
  );

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  args: {
    name: "Анна Ковалёва",
    size: "md",
  },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** No photo: the initials of the name on the muted plate. */
export const Initials: Story = {};

export const Photo: Story = {
  args: { photoUrl: PHOTO },
};

/** All three sizes: 28 / 40 / 64 (`avatar-sm` / `avatar-md` / `avatar-lg`). */
export const Sizes: Story = {
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

/** A long Cyrillic name and the longest status word at 360 px: the circle never grows. */
export const LongNameNarrow: Story = {
  args: {
    name: "Александра-Мария Константинопольская",
    status: "online",
    statusLabel: "в сети",
  },
  globals: { viewport: { value: "w360" } },
};
