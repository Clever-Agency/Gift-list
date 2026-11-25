import type { Meta, StoryObj } from "@storybook/react";
import type { NotificationItem } from "@gift-list/contracts";
import { NotificationsList } from "./notifications-list";

function noop() {}

/**
 * CLE-124/S9b-3: the holder's deadline notice. The reminder arrives before the
 * deadline and keeps «Продлить до…»; the expiry notice names the release date and
 * drops it. Both carry «Подарил» (Story 5.7).
 */
function dueItem(reminder: boolean): NotificationItem {
  return {
    id: "1",
    createdAt: "2026-11-24T10:00:00.000Z",
    readAt: null,
    href: "/gifts/example",
    event: {
      kind: "RESERVATION_DUE",
      titleSnapshot: "Абонемент на экскурсии по историческим паркам и садам",
      giftId: "example",
      actionable: true,
      bought: false,
      dueAt: reminder ? "2026-12-03T20:59:59.999Z" : "2026-11-20T20:59:59.999Z",
      timeZone: "Europe/Minsk",
      reminder,
    },
  };
}

const meta = {
  title: "App/NotificationsList",
  component: NotificationsList,
  tags: ["autodocs"],
  globals: { viewport: { value: "w360" } },
  args: {
    onOpen: noop,
    onAction: noop,
    items: [dueItem(true)],
  },
} satisfies Meta<typeof NotificationsList>;

export default meta;
type Story = StoryObj<typeof meta>;
export const PendingRequest: Story = {};
/** The request of the first row is in flight: its action is busy, the rest wait. */
export const Busy: Story = { tags: ["!dev"], args: { busyId: "1" } };
export const Empty: Story = { args: { items: [] } };
/** `Срок истёк`: «Продлить до…» больше нет, «Подарил» / «Купил» / «Снять бронь» есть. */
export const DueExpired: Story = { tags: ["!dev"], args: { items: [dueItem(false)] } };
