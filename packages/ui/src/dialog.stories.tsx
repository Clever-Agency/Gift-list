import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { XStack, YStack } from "@tamagui/stacks";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Text } from "./text";

/**
 * `Dialog` is the centred layer of the app: a question, one description line,
 * the content and the actions, over a 40% scrim. Esc, a scrim press and the cross
 * close it; focus is trapped inside on the web. The scrim and the panel fade in
 * and out with `quick` (160 ms, `DESIGN.md` → Движение); with «уменьшить
 * движение» the fade is 100 ms. The stories open it with a real press on
 * «Открыть диалог» and close it again with «Отмена».
 */
const meta = {
  title: "UI/Dialog",
  component: Dialog,
  args: {
    open: true,
    title: "Удалить желание?",
    description: "Желание исчезнет из вишлиста вместе с тегами и бронью.",
    onClose: noop,
  },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

type DialogStoryProps = {
  open: boolean;
  title: string;
  description?: string;
  role?: "dialog" | "alertdialog";
  closeAction?: { label: string; icon: React.ReactNode };
  actions?: React.ReactNode;
};

/** The layer plus the control that opens it, as a screen wires them. */
function DialogStory({ open: initialOpen, title, description, role, closeAction, actions }: DialogStoryProps) {
  const [open, setOpen] = useState(initialOpen);

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <YStack gap="$3" alignItems="center" width={320}>
      <Button label="Открыть диалог" variant="secondary" testID="open-dialog" onPress={handleOpen} />
      <Text kind="caption" tone="muted">
        Диалог: {open ? "открыт" : "закрыт"}
      </Text>
      <Dialog
        open={open}
        title={title}
        description={description}
        role={role}
        closeAction={closeAction}
        actions={actions}
        onClose={handleClose}
      />
    </YStack>
  );
}

DialogStory.displayName = "DialogStory";

/** The action row of the confirm: «Отмена» and the destructive action. */
function ConfirmActions() {
  return (
    <XStack gap="$2" flexWrap="wrap" justifyContent="flex-end">
      <Button label="Отмена" variant="ghost" onPress={noop} />
      <Button label="Удалить желание" variant="destructive" onPress={noop} />
    </XStack>
  );
}

ConfirmActions.displayName = "ConfirmActions";

/** The open state, the one the catalog is about. */
export const Open: Story = {
  render: function OpenStory() {
    return <DialogStory open title="Удалить желание?" description="Желание исчезнет из вишлиста вместе с тегами и бронью." actions={<ConfirmActions />} />;
  },
};

/** The closed state with its trigger: the story presses the trigger itself. */
export const ClosedWithTrigger: Story = {
  render: function ClosedWithTriggerStory() {
    return <DialogStory open={false} title="Удалить желание?" description="Желание исчезнет из вишлиста вместе с тегами и бронью." actions={<ConfirmActions />} />;
  },
  play: openDialog,
};

function openDialog({ canvasElement }: { canvasElement: HTMLElement }) {
  const trigger = canvasElement.querySelector<HTMLElement>("[data-testid='open-dialog']");
  trigger?.click();
}

/** A destructive confirmation is an `alertdialog` (WAI-ARIA APG). */
export const AlertDialog: Story = {
  render: function AlertDialogStory() {
    return (
      <DialogStory
        open
        role="alertdialog"
        title="Удалить желание «Плед из шерсти мериноса»?"
        description="Отменить это действие нельзя."
        actions={<ConfirmActions />}
      />
    );
  },
};

/** The close cross is a 44 × 44 control with its own name; the app draws the glyph. */
export const WithCloseCross: Story = {
  render: function WithCloseCrossStory() {
    return (
      <DialogStory
        open
        title="Настройки видимости"
        description="Желание видно только друзьям."
        closeAction={{ label: "Закрыть", icon: <Text kind="heading">×</Text> }}
      />
    );
  },
};

/** A long title and description at 360 px: the layer keeps the gutter and wraps. */
export const LongContentNarrow: Story = {
  render: function LongContentNarrowStory() {
    return (
      <DialogStory
        open
        title="Сохранить изменения в желании «Плед из шерсти мериноса с длинной бахромой»?"
        description="Вы изменили название, описание и теги. Если уйти без сохранения, правки будут потеряны."
        actions={<ConfirmActions />}
      />
    );
  },
  globals: { viewport: { value: "w360" } },
};
