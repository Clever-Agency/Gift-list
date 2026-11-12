import type { Meta, StoryObj } from "@storybook/react";
import { PersonRow } from "./person-row";

/**
 * The person card of Search (`DESIGN.md` → PersonRow, NFR-3): the name and
 * `@ник` only. Wishes, email, id and the hidden flag are never part of a search
 * answer, so they cannot appear here. With `href` the row is a real link to the
 * profile (`<a href>` on the web); without it the row is plain list content.
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

/** The usual result: a link to the profile. */
export const Link: Story = {};

/** The same card without a link, e.g. while its target is unavailable. */
export const Plain: Story = {
  args: { href: undefined, onPress: undefined, pressLabel: undefined },
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
