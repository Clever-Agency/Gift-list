import type { Meta, StoryObj } from "@storybook/react";
import { NotificationsList } from "./notifications-list";

function noop() {}

const meta = {
  title: "App/NotificationsList",
  component: NotificationsList,
  globals: { viewport: { value: "w360" } },
  args: {
    onOpen: noop,
    onAction: noop,
    items: [{
      id: "1",
      createdAt: "2026-11-24T10:00:00.000Z",
      readAt: null,
      href: "/gifts/example",
      event: {
        kind: "RESERVATION_OWNER_ASK",
        titleSnapshot: "Абонемент на экскурсии по историческим паркам и садам",
        giftId: "example",
        actionable: true,
      },
    }],
  },
} satisfies Meta<typeof NotificationsList>;

export default meta;
type Story = StoryObj<typeof meta>;
export const PendingRequest: Story = {};
export const Busy: Story = { args: { busyId: "1" } };
export const Empty: Story = { args: { items: [] } };
