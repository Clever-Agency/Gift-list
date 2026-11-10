import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { XStack, YStack } from "@tamagui/stacks";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { Text } from "./text";

/**
 * `BottomSheet` is the layer of the compact widths: it comes from the bottom, is
 * as high as its content and closes with a drag down, Esc, a scrim press and the
 * system «назад» on Android. The stories open it with a real press on the trigger.
 */
const meta = {
  title: "UI/BottomSheet",
  component: BottomSheet,
  args: {
    open: true,
    title: "Валюта подарка",
    onClose: noop,
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

type SheetStoryProps = {
  open: boolean;
  title: string;
  closeAction?: { label: string; icon: React.ReactNode };
  body: string;
};

function SheetStory({ open: initialOpen, title, closeAction, body }: SheetStoryProps) {
  const [open, setOpen] = useState(initialOpen);

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <YStack gap="$3" alignItems="center" width={320}>
      <Button label="Открыть шторку" variant="secondary" testID="open-sheet" onPress={handleOpen} />
      <Text kind="caption" tone="muted">
        Шторка: {open ? "открыта" : "закрыта"}
      </Text>
      <BottomSheet
        open={open}
        title={title}
        closeAction={closeAction}
        onClose={handleClose}
        actions={
          <XStack gap="$2" flexWrap="wrap" justifyContent="flex-end">
            <Button label="Отмена" variant="ghost" onPress={handleClose} />
            <Button label="Сохранить" variant="primary" onPress={handleClose} />
          </XStack>
        }
      >
        <Text>{body}</Text>
      </BottomSheet>
    </YStack>
  );
}

SheetStory.displayName = "SheetStory";

/** The open sheet with a heading, body and the actions row. */
export const Open: Story = {
  render: function OpenSheetStory() {
    return <SheetStory open title="Валюта подарка" body="Выберите валюту, в которой указана цена желания." />;
  },
};

/** The closed sheet with its trigger: the story presses the trigger itself. */
export const ClosedWithTrigger: Story = {
  render: function ClosedWithTriggerStory() {
    return <SheetStory open={false} title="Валюта подарка" body="Выберите валюту, в которой указана цена желания." />;
  },
  play: openSheet,
};

function openSheet({ canvasElement }: { canvasElement: HTMLElement }) {
  const trigger = canvasElement.querySelector<HTMLElement>("[data-testid='open-sheet']");
  trigger?.click();
}

/** A long heading at 360 px: the sheet keeps its gutter and the heading wraps. */
export const LongTitleNarrow: Story = {
  render: function LongTitleNarrowStory() {
    return (
      <SheetStory
        open
        title="Забронировать желание «Плед из шерсти мериноса с длинной бахромой»?"
        closeAction={{ label: "Закрыть", icon: <Text kind="heading">×</Text> }}
        body="Бронь видна только вам: владелец не узнает, кто дарит, если вы не включите это в настройках."
      />
    );
  },
  globals: { viewport: { value: "w360" } },
};
