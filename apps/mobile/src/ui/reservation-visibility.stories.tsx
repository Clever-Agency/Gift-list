import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { ReservationVisibility, type ReservationVisibilityProps } from "./reservation-visibility";

/**
 * «Показывать другим гостям, что дарю я» (D-57, `DESIGN.md` → ReservationCard):
 * один переключатель держателя без раскрывашки. CLE-124/D-49: «владельцу»
 * больше нет, остался только переключатель для других гостей.
 */
const meta = {
  title: "App/ReservationVisibility",
  component: ReservationVisibility,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof ReservationVisibility>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

const base = {
  values: { holderVisibleToOthers: true },
  onChange: noop,
} satisfies ReservationVisibilityProps;

/** The switch inside the page column: the catalog frame does not shrink it. */
function column(args: Partial<ReservationVisibilityProps>) {
  return (
    <YStack padding="$page-gutter" width="100%" maxWidth={343}>
      <ReservationVisibility
        values={args.values ?? { holderVisibleToOthers: true }}
        busy={args.busy}
        onChange={args.onChange ?? noop}
      />
    </YStack>
  );
}

/** Включён — значение по умолчанию при брони. */
export const Normal: Story = {
  args: base,
  render: column,
};

/** Выключен: другие гости не видят, что дарит держатель. */
export const Off: Story = {
  tags: ["!dev"],
  args: { ...base, values: { holderVisibleToOthers: false } },
  render: column,
};

/** Запрос в полёте: значение показано, менять нельзя. */
export const Busy: Story = {
  tags: ["!dev"],
  args: { ...base, busy: true },
  render: column,
};
