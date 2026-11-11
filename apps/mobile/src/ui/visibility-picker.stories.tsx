import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ComponentProps } from "react";
import { Button, Text, YStack } from "@gift-list/ui";
import { VisibilityPicker } from "./visibility-picker";

/**
 * The owner's visibility dialog: the same radio rows as the wish form
 * (`ChoiceGroup`), focused on the current value when it opens. Esc, the scrim and
 * «Отмена» close it through `onClose`; while it is closed it renders nothing.
 */
const meta = {
  title: "App/VisibilityPicker",
  component: VisibilityPicker,
  args: {
    visible: true,
    title: "Плед из шерсти мериноса",
    value: "PUBLIC",
    onSelect: noop,
    onClose: noop,
    onClosed: noop,
  },
} satisfies Meta<typeof VisibilityPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** Open on an «Всем» wish: focus lands on the radio that holds the current value. */
export const OpenPublic: Story = {};

/** Open on a secret wish. */
export const OpenSecret: Story = {
  args: { value: "SECRET" },
};

/** The closed state with the trigger the owner presses; the story presses it. */
export const ClosedWithTrigger: Story = {
  args: { visible: false },
  render: function ClosedWithTriggerStory(args) {
    return <PickerStory {...args} />;
  },
  play: openPicker,
};

function openPicker({ canvasElement }: { canvasElement: HTMLElement }) {
  const trigger = canvasElement.querySelector<HTMLElement>("[data-testid='open-picker']");
  trigger?.click();
}

/** A long wish title at 360 px: «Кто видит «…»» wraps above the rows. */
export const LongTitleNarrow: Story = {
  args: {
    title: "Плед из шерсти мериноса с длинной бахромой и подогревом",
    value: "FRIENDS",
  },
  render: function LongTitleNarrowStory(args) {
    return (
      <YStack width={328}>
        <VisibilityPicker {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A screen-owned trigger, as the wishlist wires it to the visibility chip. */
function PickerStory({
  visible: initialVisible,
  ...props
}: ComponentProps<typeof VisibilityPicker>) {
  const [visible, setVisible] = useState(initialVisible);

  function handleOpen() {
    setVisible(true);
  }

  function handleClose() {
    setVisible(false);
  }

  return (
    <YStack gap="$3" alignItems="center">
      <Button label="Открыть видимость" variant="secondary" testID="open-picker" onPress={handleOpen} />
      <Text kind="caption" tone="muted">
        Диалог: {visible ? "открыт" : "закрыт"}
      </Text>
      <VisibilityPicker
        {...props}
        visible={visible}
        onClose={handleClose}
        onSelect={handleClose}
        onClosed={noop}
      />
    </YStack>
  );
}

PickerStory.displayName = "PickerStory";
