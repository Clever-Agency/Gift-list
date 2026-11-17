import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ComponentProps } from "react";
import { YStack } from "@gift-list/ui";
import { ChoiceGroup } from "./gift-form";

/**
 * The one `radiogroup` behind the currency codes, visibility and quantity of the
 * wish form, and the rows of `VisibilityPicker` (it lives in `gift-form.tsx`
 * because the form owns the shared options). `rows` carries a hint under each
 * label; `chips` is the compact currency strip.
 */
type Props = ComponentProps<typeof ChoiceGroup>;

function noop() {}

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Всем", hint: "по ссылке, подписчикам и в профиле" },
  { value: "FRIENDS", label: "Друзьям", hint: "только друзья" },
  { value: "SECRET", label: "Секрет", hint: "только вы" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "CNY", label: "CNY" },
  { value: "BYN", label: "BYN" },
  { value: "RUB", label: "RUB" },
];

const QUANTITY_OPTIONS = [
  { value: "SINGLE", label: "Один раз", hint: "Желание можно забронировать один раз." },
  {
    value: "UNLIMITED",
    label: "Можно дарить снова",
    hint: "Такое желание нельзя забронировать — дарить можно сколько угодно раз.",
  },
];

const meta = {
  title: "App/ChoiceGroup",
  component: ChoiceGroup,
  args: {
    label: "Кто видит",
    value: "PUBLIC",
    onChange: noop,
    options: VISIBILITY_OPTIONS,
    variant: "rows",
  },
  render: ControlledChoiceGroup,
} satisfies Meta<typeof ChoiceGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A radiogroup is controlled: the story holds the value, as the form does. */
function ControlledChoiceGroup({ value: initialValue, ...props }: Props) {
  const [value, setValue] = useState(initialValue);
  return <ChoiceGroup {...props} value={value} onChange={setValue} />;
}

ControlledChoiceGroup.displayName = "ControlledChoiceGroup";

/** Visibility as the form draws it: radio rows with an explanation each. */
export const Rows: Story = {};

/** Quantity rows: «Один раз» versus «Можно дарить снова». */
export const QuantityRows: Story = {
  args: { label: "Сколько раз можно дарить", value: "SINGLE", options: QUANTITY_OPTIONS },
  render: function QuantityRowsStory(args) {
    return (
      <YStack width={328}>
        <ControlledChoiceGroup {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The currency strip: chips, five closed codes. */
export const CurrencyChips: Story = {
  args: { label: "Валюта", value: "RUB", options: CURRENCY_OPTIONS, variant: "chips" },
  render: function CurrencyChipsStory(args) {
    return (
      <YStack width={328}>
        <ControlledChoiceGroup {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A rejection from the server under the group: the error line plus `aria-invalid`. */
export const WithError: Story = {
  args: { error: "Проверьте введённые данные." },
  render: function WithErrorStory(args) {
    return (
      <YStack width={328}>
        <ControlledChoiceGroup {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The wish is no longer open: the stored value stays visible, nothing can change. */
export const Disabled: Story = {
  args: {
    value: "FRIENDS",
    disabled: true,
    description: "Видимость меняется только у открытого желания.",
  },
  render: function DisabledStory(args) {
    return (
      <YStack width={328}>
        <ChoiceGroup {...args} onChange={noop} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** `labelHidden` keeps the accessible name while the layer above draws the heading. */
export const LabelHidden: Story = {
  args: { labelHidden: true },
  render: function LabelHiddenStory(args) {
    return (
      <YStack width={328}>
        <ControlledChoiceGroup {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
