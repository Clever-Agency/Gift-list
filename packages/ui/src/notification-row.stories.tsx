import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Bell } from "./icons";
import { NotificationRow } from "./notification-row";

const meta = {
  title: "UI/NotificationRow",
  component: NotificationRow,
  args: {
    message: "Срок брони «Абонемент в ботанический сад» истёк. Подарок уже у вас?",
    time: "Сегодня, 10:24",
    newLabel: "Новое",
    unread: true,
    icon: <Bell size={20} />,
  },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof NotificationRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnreadLongCyrillic: Story = {};
export const ReadStale: Story = { args: { unread: false, subtitle: "Даритель уже ответил" } };
export const WaitingForAction: Story = {
  args: { actions: <Button variant="secondary" label="Не получал, оставить бронь" busy /> },
};
