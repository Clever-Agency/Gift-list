import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { useEffect, useState, type ComponentType } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { SegmentTabs, type SegmentTab, type SegmentTabsProps } from "./segment-tabs";
import { Text } from "./text";

/**
 * The segment props plus the «бейдж запросов» catalog handle. The tab list is a
 * ready-made set of the product sections, so the count of the «Запросы» tab is a
 * number instead of an array knob. The cast on `component` is what lets the Docs
 * controls see the handle; the component itself stays unchanged.
 */
type SegmentTabsCatalogProps = Omit<SegmentTabsProps, "tabs"> & {
  tabs?: SegmentTab[];
  requestsBadge: number;
};

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/** The three sections of the friends screen, in the product order. */
function readyTabs(requestsBadge: number): SegmentTab[] {
  return [
    { key: "friends", label: "Друзья" },
    { key: "subscriptions", label: "Подписки" },
    {
      key: "requests",
      label: "Запросы",
      badge: requestsBadge > 0 ? requestsBadge : undefined,
    },
  ];
}

/**
 * `DESIGN.md` → Мелкие элементы: the segment «Друзья · Подписки · Запросы» — text
 * `label`, the selected one 600 with a 2 px `primary` underline. The arrows move
 * between tabs, Home and End jump to the ends. The sandbox really selects, so the
 * underline and the `aria-selected` state are live.
 */
const meta = {
  title: "UI/SegmentTabs",
  component: SegmentTabs as unknown as ComponentType<SegmentTabsCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The segment «Друзья · Подписки · Запросы» (\`DESIGN.md\` → Мелкие элементы): text \`label\`, the selected one 600 with a 2 px \`primary\` underline.

What is not a prop:

- The tab list is a ready-made set of the product sections: the «бейдж запросов» handle changes only the count of «Запросы», not the array shape.
- The group is a \`tablist\` of real tabs (\`aria-selected\`). The arrows move between them and activate the neighbour (WAI-ARIA APG, automatic activation); Home and End jump to the ends.
- The count badge is drawn next to its tab and read with its name, e.g. «Запросы, 3»; the badge number is never colour-only information.
- The screen owns \`value\` and \`onChange\`; the sandbox keeps the selection locally, so a press really moves the underline.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description: "The accessible name of the whole tab group, e.g. «Разделы друзей».",
      type: "string",
      required: true,
      control: "text",
    }),
    tabs: propDoc({
      description:
        "The tabs in the product order. The sandbox builds «Друзья · Подписки · Запросы» itself; the showcases below may pass another set.",
      type: "SegmentTab[]",
      required: true,
      control: false,
    }),
    value: propDoc({
      description:
        "The key of the selected tab. The sandbox keeps it locally and follows this control; a press or an arrow key really moves the selection.",
      type: "string",
      required: true,
      control: "text",
    }),
    onChange: propDoc({
      description:
        "The key of the tab the person picked; the screen owns the selection. Not a control: the sandbox selects locally and calls the `noop`.",
      type: "(key: string) => void",
      required: true,
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    requestsBadge: {
      name: "бейдж запросов",
      description:
        "Ручка каталога: число на вкладке «Запросы»; 0 убирает бейдж. Число входит в имя вкладки для диктора.",
      control: "number",
      table: {
        category: "Ручки каталога",
        type: { summary: "number" },
        defaultValue: { summary: "3" },
      },
    },
  },
  args: {
    label: "Разделы друзей",
    value: "friends",
    onChange: noop,
    testID: "segment-tabs",
    requestsBadge: 3,
  },
} satisfies Meta<SegmentTabsCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

function SegmentTabsPreview({
  requestsBadge,
  tabs,
  value: valueArg,
  onChange,
  ...tabsArgs
}: SegmentTabsCatalogProps) {
  const [value, setValue] = useState(valueArg);

  useEffect(
    function syncValueFromControls() {
      setValue(valueArg);
    },
    [valueArg],
  );

  function handleChange(next: string) {
    setValue(next);
    onChange?.(next);
  }

  return (
    <YStack width={360} maxWidth="100%">
      <SegmentTabs
        {...tabsArgs}
        tabs={tabs ?? readyTabs(requestsBadge)}
        value={value}
        onChange={handleChange}
      />
    </YStack>
  );
}

SegmentTabsPreview.displayName = "SegmentTabsPreview";

/**
 * The sandbox: press a tab — the selection and `aria-selected` really flip — and
 * turn the label, the selected key and the «Запросы» badge in the panel. The
 * arrows move the selection too.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <SegmentTabsPreview {...args} />;
  },
};

/** «Запросы» selected with the incoming badge — the state the friends screen opens on. */
export const RequestsWithBadge: Story = {
  args: { value: "requests" },
  render: function RequestsWithBadgeStory(args) {
    return <SegmentTabsPreview {...args} />;
  },
};

/** The default: the first tab is selected. */
export const FriendsSelected: Story = {
  tags: ["!dev"],
  render: function FriendsSelectedStory(args) {
    return <SegmentTabsPreview {...args} />;
  },
};

/** «Подписки» selected: the choice is remembered by the screen. */
export const SubscriptionsSelected: Story = {
  tags: ["!dev"],
  args: { value: "subscriptions" },
  render: function SubscriptionsSelectedStory(args) {
    return <SegmentTabsPreview {...args} />;
  },
};

/** A real state change: pressing a tab selects it, the arrows move the selection. */
function LiveSegmentStory() {
  const [value, setValue] = useState("friends");
  return (
    <YStack gap="$2" alignItems="flex-start">
      <SegmentTabs label="Разделы друзей" tabs={readyTabs(3)} value={value} onChange={setValue} />
      <Text kind="caption" tone="muted">
        Selected: {value}
      </Text>
    </YStack>
  );
}

LiveSegmentStory.displayName = "LiveSegmentStory";

export const Live: Story = {
  tags: ["!dev"],
  render: LiveSegmentStory,
};

/** No badge (the subscriptions segment): only the labels. */
export const WithoutBadge: Story = {
  tags: ["!dev"],
  args: {
    tabs: [
      { key: "friends", label: "Друзья" },
      { key: "subscriptions", label: "Подписки" },
      { key: "requests", label: "Запросы" },
    ],
  },
  render: function WithoutBadgeStory(args) {
    return <SegmentTabsPreview {...args} />;
  },
};

/** Long Cyrillic labels at 360 px: the tabs wrap instead of clipping. */
export const LongLabelsNarrow: Story = {
  tags: ["!dev"],
  args: {
    tabs: [
      { key: "friends", label: "Друзья" },
      { key: "subscriptions", label: "Мои подписчики" },
      { key: "requests", label: "Запросы", badge: 12 },
    ],
  },
  render: function LongLabelsNarrowStory(args) {
    return <SegmentTabsPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};
