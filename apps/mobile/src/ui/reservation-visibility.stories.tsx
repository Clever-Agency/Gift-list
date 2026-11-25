import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { ReservationVisibility, type ReservationVisibilityProps } from "./reservation-visibility";

/**
 * «Кто видит, что это я» (Story 5.5, `DESIGN.md` → ReservationCard): свёрнутый
 * блок двух переключателей держателя. Свёрнутый в дереве не держит ни одного
 * переключателя; включённое «владельцу» показывает подсказку FR-31.
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
  expanded: false,
  onToggle: noop,
  values: { holderVisibleToOwner: false, holderVisibleToOthers: true },
  onChange: noop,
} satisfies ReservationVisibilityProps;

/** The block inside the page column: the catalog frame does not shrink it. */
function column(args: Partial<ReservationVisibilityProps>) {
  return (
    <YStack padding="$page-gutter" width="100%" maxWidth={343}>
      <ReservationVisibility
        expanded={args.expanded ?? false}
        onToggle={args.onToggle ?? noop}
        values={
          args.values ?? { holderVisibleToOwner: false, holderVisibleToOthers: true }
        }
        busy={args.busy}
        onChange={args.onChange ?? noop}
      />
    </YStack>
  );
}

/** Свёрнутый блок — состояние по умолчанию. */
export const Collapsed: Story = {
  args: base,
  render: column,
};

/** Раскрытый: два переключателя, имя владельцу скрыто. */
export const Expanded: Story = {
  args: { ...base, expanded: true },
  render: column,
};

/** Раскрытый с включённым «владельцу»: подсказка «он может уже знать». */
export const OwnerVisible: Story = {
  tags: ["!dev"],
  args: {
    ...base,
    expanded: true,
    values: { holderVisibleToOwner: true, holderVisibleToOthers: true },
  },
  render: column,
};

/** Запрос в полёте: значения показаны, менять нельзя. */
export const Busy: Story = {
  tags: ["!dev"],
  args: { ...base, expanded: true, busy: true },
  render: column,
};
