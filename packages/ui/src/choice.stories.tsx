import type { Meta, StoryObj } from "@storybook/react";
import { Choice, ChoiceList } from "./choice";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

const meta = {
  title: "UI/Choice",
  component: Choice,
  args: {
    variant: "row",
    label: "Показывать друзьям",
    hint: "Видно всем в списке друзей",
    selected: false,
    onPress: noop,
  },
} satisfies Meta<typeof Choice>;

export default meta;

type Story = StoryObj<typeof meta>;

/** `row`: a radio dot, the label and a hint line. */
export const RowUnselected: Story = {};

export const RowSelected: Story = {
  args: { selected: true },
};

export const RowWithoutHint: Story = {
  args: { label: "Скрыть из поиска", hint: undefined },
};

/** The stored value is shown but cannot change (other states lock the field). */
export const RowDisabled: Story = {
  args: { selected: true, disabled: true },
};

/** `chip`: a compact option, e.g. a currency code. */
export const ChipUnselected: Story = {
  args: { variant: "chip", label: "BYN", hint: undefined },
};

export const ChipSelected: Story = {
  args: { variant: "chip", label: "BYN", hint: undefined, selected: true },
};

export const ChipDisabled: Story = {
  args: { variant: "chip", label: "BYN", hint: undefined, disabled: true },
};

/** The group error is painted around the list, linked and read with each option. */
function ChoiceListWithErrorStory() {
  return (
    <ChoiceList
      label="Валюта подарка"
      heading="Валюта"
      variant="row"
      error="Выберите валюту: без неё нельзя сохранить желание"
    >
      <Choice variant="row" label="BYN — белорусский рубль" selected onPress={noop} />
      <Choice variant="row" label="RUB — российский рубль" selected={false} onPress={noop} />
    </ChoiceList>
  );
}

ChoiceListWithErrorStory.displayName = "ChoiceListWithErrorStory";

/** A locked group: the description says why, every option is disabled. */
function ChoiceListLockedStory() {
  return (
    <ChoiceList
      label="Валюта подарка"
      heading="Валюта"
      variant="chip"
      description="Валюту нельзя изменить: подарок уже забронирован"
    >
      <Choice variant="chip" label="BYN" selected disabled onPress={noop} />
      <Choice variant="chip" label="RUB" selected={false} disabled onPress={noop} />
      <Choice variant="chip" label="USD" selected={false} disabled onPress={noop} />
    </ChoiceList>
  );
}

ChoiceListLockedStory.displayName = "ChoiceListLockedStory";

export const ListWithError: Story = {
  render: ChoiceListWithErrorStory,
};

export const ListLocked: Story = {
  render: ChoiceListLockedStory,
};
