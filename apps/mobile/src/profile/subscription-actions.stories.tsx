import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@gift-list/ui";
import { RelationshipActions } from "./relationship-actions";
import { SubscriptionActions } from "./subscription-actions";

/**
 * The one-way subscription switch of a profile (Story 4.6, FR-46, AD-19). The
 * label is the current fact, not a direction: «Подписаться» while the viewer has
 * no edge, «Отписаться» once the server reports one. A subscription is not a
 * friendship, so the screen draws the button next to the friend action instead of
 * replacing it, and hides it on the viewer's own profile and on a friend, who
 * already sees more (`EXPERIENCE.md` → Профиль).
 *
 * The labels are the profile catalogue keys (`app.profile.subscription.*`), so the
 * stories only pick the server fact and the press state.
 */
const meta = {
  title: "App/SubscriptionActions",
  component: SubscriptionActions,
  args: {
    subscribed: false,
    busy: false,
    onAction: noop,
  },
} satisfies Meta<typeof SubscriptionActions>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** No edge in either direction: «Подписаться». */
export const Subscribe: Story = {};

/** The server reports an edge: the same button now says «Отписаться». */
export const Unsubscribe: Story = {
  args: { subscribed: true },
};

/** The subscribe press is in flight: the label keeps its width, the button is announced busy. */
export const BusySubscribe: Story = {
  args: { busy: true },
};

/** The unsubscribe press is in flight. */
export const BusyUnsubscribe: Story = {
  args: { subscribed: true, busy: true },
};

/** The profile row at 360 px: the subscription sits next to the friend action, not instead of it. */
export const InProfileActionsRow: Story = {
  render: function InProfileActionsRowStory(args) {
    return (
      <YStack width={328}>
        <XStack flexWrap="wrap" alignItems="center" gap="$2">
          <RelationshipActions
            relationship="NONE"
            inviteCooldown={null}
            ownProfile={false}
            busy={false}
            onAction={noop}
          />
          <SubscriptionActions {...args} />
        </XStack>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
