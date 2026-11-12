import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { RelationshipActions } from "./relationship-actions";

/**
 * The relation of a person plus the friend actions the viewer can take: one
 * closed set for `/u/:nick` and the search row (Story 4.1.3 / 4.2.3). The labels
 * are the profile catalogue keys (`app.profile.relationship.*`), the same words
 * in both places.
 *
 * The rejection window wins over the relationship: while it is live the button is
 * disabled and the row explains the remaining hours, and the sender of the
 * rejected invite sees the «Отклонено» chip instead. `ownProfile` stands for the
 * `SELF` value the contract never carries: «Это вы» and no action at all.
 *
 * `testIDPrefix` only namespaces the `data-testid`s, so two search rows never
 * share ids; the default `profile` is what the stories below use.
 */
const meta = {
  title: "App/RelationshipActions",
  component: RelationshipActions,
  args: {
    relationship: "NONE",
    inviteCooldown: null,
    ownProfile: false,
    busy: false,
    onAction: noop,
  },
} satisfies Meta<typeof RelationshipActions>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** No edge and no window: one «Добавить в друзья» button. */
export const NoRelation: Story = {};

/** The viewer sent an invite: the chip only, the owner still has to answer. */
export const OutgoingPending: Story = {
  args: { relationship: "OUTGOING_PENDING" },
};

/** The owner sent an invite: the emphasized chip, «Принять приглашение» and the ghost «Отклонить». */
export const IncomingPending: Story = {
  args: { relationship: "INCOMING_PENDING" },
};

/** An accepted edge: the chip only, there is no friend action left to press. */
export const Friends: Story = {
  args: { relationship: "FRIENDS" },
};

/** The viewer's own card: «Это вы» instead of any action. */
export const OwnProfile: Story = {
  args: { ownProfile: true },
};

/**
 * The live rejection window: «Добавить в друзья» is disabled but stays in the Tab
 * order (`focusableWhenDisabled`), so a keyboard user can read why, and the
 * caption names the remaining hours.
 */
export const InviteCooldown: Story = {
  args: { inviteCooldown: { hours: 24, rejected: false } },
};

/** The shortest window: «Можно снова через 1 ч» at 360 px. */
export const InviteCooldownShort: Story = {
  args: { inviteCooldown: { hours: 1, rejected: false } },
  globals: { viewport: { value: "w360" } },
};

/** The sender of the rejected invite: the chip says «Отклонено», not the disabled button. */
export const Rejected: Story = {
  args: { inviteCooldown: { hours: 24, rejected: true } },
};

/** The add press is in flight: the label keeps its width, the button takes no second press. */
export const BusyAddFriend: Story = {
  args: { busy: true },
};

/** An invite answer is in flight: both incoming buttons are busy. */
export const BusyIncoming: Story = {
  args: { relationship: "INCOMING_PENDING", busy: true },
};

/** The incoming invite at 360 px: the chip and two buttons wrap inside the page gutter. */
export const IncomingPendingNarrow: Story = {
  args: { relationship: "INCOMING_PENDING" },
  render: function IncomingPendingNarrowStory(args) {
    return (
      <YStack width={328}>
        <RelationshipActions {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
