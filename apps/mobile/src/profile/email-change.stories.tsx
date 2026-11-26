import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { EmailChangeBlock } from "./email-change";

/**
 * The email row of «Профиль» (CLE-129/T9.2, FR-56, Story 6.8): the current
 * address with «Изменить», the new-address field, and the waiting notice after
 * the letter is accepted. The account keeps signing in with the old address
 * until the one-time link on the new one is opened.
 *
 * The block is presentational: the screen owns the requests, so the states that
 * are hard to reach live here — a failed send, a live rate limit, a busy press.
 */
const meta = {
  title: "App/EmailChangeBlock",
  component: EmailChangeBlock,
  tags: ["autodocs"],
  args: {
    email: "anya@example.com",
    mode: "idle",
    value: "",
    busy: false,
    onChange: noop,
    onEdit: noop,
    onSubmit: noop,
    onClose: noop,
    onResend: noop,
    onCancel: noop,
  },
} satisfies Meta<typeof EmailChangeBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** The resting row: the address and one «Изменить». */
export const Idle: Story = {};

/** The field of the new address, with «Отправить письмо» and «Отмена». */
export const Form: Story = {
  args: { mode: "form", value: "anna@example.com" },
};

/** The client rule of the contract: an invalid address is named under the field. */
export const FormInvalid: Story = {
  tags: ["!dev"],
  args: {
    mode: "form",
    value: "anna",
    error: "Проверьте введённые данные.",
  },
};

/** The send is in flight: the buttons keep their widths and take no second press. */
export const FormBusy: Story = {
  tags: ["!dev"],
  args: { mode: "form", value: "anna@example.com", busy: true },
};

/** The letter is accepted: the waiting notice with «Отправить ещё раз» and «Отменить». */
export const Sent: Story = {
  args: { mode: "sent", sentTo: "anna@example.com" },
};

/** A live rate limit: the same notice keeps the reason and the wait in words. */
export const SentRateLimited: Story = {
  tags: ["!dev"],
  args: {
    mode: "sent",
    sentTo: "anna@example.com",
    error: "Слишком много попыток. Попробуйте через 15 минут.",
  },
};

/** A resend or a cancel is in flight. */
export const SentBusy: Story = {
  tags: ["!dev"],
  args: { mode: "sent", sentTo: "anna@example.com", busy: true },
};

/** The field at 360 px: the full-width buttons stay inside the page gutter. */
export const FormNarrow: Story = {
  args: { mode: "form", value: "anna@example.com" },
  render: function FormNarrowStory(args) {
    return (
      <YStack width={328}>
        <EmailChangeBlock {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
