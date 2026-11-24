import type { Meta, StoryObj } from "@storybook/react";
import { NotificationBellControl } from "./notification-bell";

function noop() {}

const meta = {
  title: "App/NotificationBell",
  component: NotificationBellControl,
  args: { count: 0, onPress: noop },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof NotificationBellControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoUnread: Story = {};
export const WithUnread: Story = { args: { count: 12 } };
export const Overflow: Story = { args: { count: 127 } };
