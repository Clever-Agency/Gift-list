import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { XStack, YStack } from "@tamagui/stacks";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { Dialog, type DialogProps } from "./dialog";
import { Text } from "./text";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

const DIALOG_ROLES = ["dialog", "alertdialog"] as const;
const DIALOG_LAYOUTS = ["default", "detail"] as const;

/**
 * `Dialog` is the centred layer of the app: a question, one description line,
 * the content and the actions, over a 40% scrim. Esc, a scrim press and the cross
 * close it; focus is trapped inside on the web. The scrim and the panel fade in
 * and out with `quick` (160 ms, `DESIGN.md` → Движение); with «уменьшить
 * движение» the fade is 100 ms.
 *
 * `layout="detail"` is the wide scrolling layer: almost the full screen below the
 * `medium` breakpoint and up to `detail-width` above it, with a scrolling body.
 * The same slot content is used for the guest, loading and error examples
 * below, and `BottomSheet` keeps no separate catalog page.
 *
 * Every showcase on the docs page runs in its own iframe
 * (`docs.story.inline: false`): a layer paints its scrim over the whole
 * document, so an inline open window would cover the description, the controls
 * and the neighbouring showcases.
 */
const meta = {
  title: "UI/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The centred layer of the app. On the web it is a modal \`role="dialog"\` (or \`alertdialog\` for a destructive confirmation); Esc, a scrim press and the close cross close it, and focus is trapped inside.

What is not a prop:

- The closing motion (\`quick\`, 160 ms; 100 ms with reduced motion) is painted by the layer.
- Focus starts on the title, or on \`initialFocus\` when the screen passes a ref (a destructive confirm lands on «Отмена»).
- \`layout="detail"\` only changes the width and makes the body scroll; it is still this component.
- \`BottomSheet\` is a different layer (a phone sheet, not a centred window) and keeps its own component. The last two showcases below show how the same content looks in it.
        `.trim(),
      },
      // `@storybook/react` turns `docs.story.inline` on by default for every
      // story; an inline layer then paints its scrim and panel over the whole
      // docs page. Each showcase gets its own iframe instead, tall enough for an
      // open dialog or a bottom sheet (`iframeHeight` is the frame height).
      story: { inline: false, iframeHeight: "420px" },
    },
  },
  argTypes: {
    open: propDoc({
      description:
        "Whether the layer is in the tree. The screen owns the value: on close it sets `open` to `false` (usually from `onClose`).",
      type: "boolean",
      required: true,
    }),
    title: propDoc({
      description:
        "The question or the name of the layer. It is the dialog's accessible name.",
      type: "string",
      required: true,
      control: "text",
    }),
    description: propDoc({
      description: "One line under the title, e.g. what happens on confirm.",
      type: "string",
      control: "text",
    }),
    onClose: propDoc({
      description:
        "Esc, Android «назад», a scrim press and the cross call it; the screen closes the layer by setting `open` to `false`.",
      type: "() => void",
      required: true,
      control: false,
    }),
    onClosed: propDoc({
      description:
        "The layer has really left the tree, so the screen can put focus back on the control it was opened from (`restoreFocus`). Without it the browser returns focus to the element focused before opening.",
      type: "() => void",
      control: false,
    }),
    initialFocus: propDoc({
      description:
        "Where focus lands on opening: a ref to a control. Defaults to the title. A destructive confirm passes «Отмена», so Enter right after opening deletes nothing.",
      type: "RefObject<FocusTarget | null>",
      control: false,
    }),
    role: propDoc({
      description:
        "`alertdialog` for a destructive confirmation (WAI-ARIA APG); `dialog` for everything else.",
      type: formatUnionType(DIALOG_ROLES),
      options: DIALOG_ROLES,
      defaultValue: "dialog",
    }),
    closeAction: propDoc({
      description:
        "A close cross at the end of the title row: `{ label, icon }`. The app draws the icon; the label is the accessible name. The catalog shows it with the «крестик» handle.",
      type: "{ label: string; icon: ReactNode }",
      control: false,
    }),
    children: propDoc({
      description:
        "The body between the title and the actions. With `layout=\"detail\"` it scrolls while the title and the cross stay in view.",
      type: "ReactNode",
      control: false,
    }),
    actions: propDoc({
      description:
        "The buttons row, aligned to the end and wrapping on a narrow width. The catalog shows it with the «есть действия» handle.",
      type: "ReactNode",
      control: false,
    }),
    layout: propDoc({
      description:
        "`default` is the confirm width. `detail` is the wish-detail layer: almost the full screen below the `medium` breakpoint and up to `detail-width` above it.",
      type: formatUnionType(DIALOG_LAYOUTS),
      options: DIALOG_LAYOUTS,
      defaultValue: "default",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    showCloseCross: {
      name: "крестик",
      description: "Ручка каталога: показать слот `closeAction` с готовым образцом крестика.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    showActions: {
      name: "есть действия",
      description: "Ручка каталога: показать слот `actions` с готовой строкой кнопок.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
  },
  args: {
    open: true,
    title: "Удалить желание?",
    description: "Желание исчезнет из вишлиста. Это нельзя отменить.",
    role: "dialog",
    layout: "default",
    testID: "dialog",
    showCloseCross: true,
    showActions: true,
    onClose: noop,
    onClosed: noop,
  },
} satisfies Meta<DialogProps & { showCloseCross: boolean; showActions: boolean }>;

export default meta;

type Story = StoryObj<typeof meta>;

type DialogStoryProps = {
  open: boolean;
  title: string;
  description?: string;
  role?: "dialog" | "alertdialog";
  closeAction?: { label: string; icon: React.ReactNode };
  actions?: React.ReactNode;
};

const CLOSE_ACTION = { label: "Закрыть", icon: <Text kind="heading">×</Text> };

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

/** The layer plus the control that opens it, as a screen wires them. */
function DialogStory({
  open: initialOpen,
  title,
  description,
  role,
  closeAction,
  actions,
}: DialogStoryProps) {
  const [open, setOpen] = useState(initialOpen);

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <YStack gap="$3" alignItems="center" width={320}>
      <Button
        label="Открыть диалог"
        variant="secondary"
        testID="open-dialog"
        onPress={handleOpen}
      />
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

type DialogCatalogArgs = DialogProps & {
  showCloseCross: boolean;
  showActions: boolean;
};

/**
 * The sandbox: every public prop is a control (`argTypes`), the slots have the
 * catalogue fixtures behind the «крестик» and «есть действия» handles, and the
 * callbacks stay `noop`. Flip `open` to see the closed state, then open the
 * closed frame below to close it with the trigger, Esc or a scrim press.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    const { showCloseCross, showActions, ...dialogArgs } = args as DialogCatalogArgs;
    return (
      <Dialog
        {...dialogArgs}
        closeAction={showCloseCross ? CLOSE_ACTION : undefined}
        actions={showActions ? <ConfirmActions /> : undefined}
      >
        <Text kind="body">Вы сможете восстановить желание в течение 30 дней.</Text>
      </Dialog>
    );
  },
};

/** The closed layer with its trigger: press «Открыть диалог» to open it. */
export const ClosedWithTrigger: Story = {
  render: function ClosedWithTriggerStory() {
    return (
      <DialogStory
        open={false}
        title="Удалить желание?"
        description="Желание исчезнет из вишлиста. Это нельзя отменить."
        actions={<ConfirmActions />}
      />
    );
  },
};

/** The open state of the confirm, the one the catalog is about. */
export const Open: Story = {
  tags: ["!dev"],
  render: function OpenStory() {
    return (
      <DialogStory
        open
        title="Удалить желание?"
        description="Желание исчезнет из вишлиста. Это нельзя отменить."
        actions={<ConfirmActions />}
      />
    );
  },
};

/** A destructive confirmation is an `alertdialog` (WAI-ARIA APG). */
export const AlertDialog: Story = {
  tags: ["!dev"],
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
  tags: ["!dev"],
  render: function WithCloseCrossStory() {
    return (
      <DialogStory
        open
        title="Настройки видимости"
        description="Желание видно только друзьям."
        closeAction={CLOSE_ACTION}
      />
    );
  },
};

/** A long title and description at 360 px: the layer keeps the gutter and wraps. */
export const LongContentNarrow: Story = {
  tags: ["!dev"],
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

type DetailFact = {
  id: string;
  label: string;
  value: string;
};

const DETAIL_FACTS: DetailFact[] = [
  { id: "description", label: "Описание", value: "Тёплый, 200 × 140, цвет — овсяный." },
  { id: "price", label: "Цена", value: "2 500 ₽" },
  { id: "link", label: "Ссылка", value: "https://shop.example/pled" },
  { id: "quantity", label: "Сколько раз можно дарить", value: "Один раз" },
  { id: "expires", label: "Актуально до", value: "31.12.2026" },
  { id: "tags", label: "Теги", value: "Дом, Уют" },
  { id: "status", label: "Статус", value: "Открыт" },
];

function DetailFacts({ facts = DETAIL_FACTS }: { facts?: DetailFact[] }) {
  return (
    <YStack gap="$3">
      {facts.map(function renderFact(fact) {
        return (
          <YStack key={fact.id} gap="$1">
            <Text kind="label" tone="muted">
              {fact.label}
            </Text>
            <Text kind="body">{fact.value}</Text>
          </YStack>
        );
      })}
    </YStack>
  );
}

DetailFacts.displayName = "DetailFacts";

type DetailStoryProps = {
  notice?: string;
  retry?: { label: string; onPress: () => void };
  facts?: DetailFact[];
};

/** `layout="detail"` with the guest facts: the wide scrolling layer. */
function DetailDialogStory({ notice, retry, facts }: DetailStoryProps) {
  return (
    <Dialog
      open
      layout="detail"
      title="Плед из шерсти мериноса"
      closeAction={CLOSE_ACTION}
      onClose={noop}
    >
      {notice ? (
        <YStack gap="$3">
          <Text kind="body">{notice}</Text>
          {retry ? (
            <Button label={retry.label} variant="secondary" onPress={retry.onPress} />
          ) : null}
        </YStack>
      ) : (
        <YStack gap="$3">
          <DetailFacts facts={facts} />
        </YStack>
      )}
    </Dialog>
  );
}

DetailDialogStory.displayName = "DetailDialogStory";

/** The detail width with the facts a guest sees. */
export const DetailGuest: Story = {
  name: "Detail: guest",
  tags: ["!dev"],
  parameters: { docs: { story: { iframeHeight: "640px" } } },
  render: function DetailGuestStory() {
    return <DetailDialogStory />;
  },
};

/** The loading notice instead of facts. */
export const DetailLoading: Story = {
  name: "Detail: loading",
  tags: ["!dev"],
  parameters: { docs: { story: { iframeHeight: "640px" } } },
  render: function DetailLoadingStory() {
    return <DetailDialogStory notice="Загружаем желание" />;
  },
};

/** The network error with its retry action. */
export const DetailNetworkError: Story = {
  name: "Detail: network error",
  tags: ["!dev"],
  parameters: { docs: { story: { iframeHeight: "640px" } } },
  render: function DetailNetworkErrorStory() {
    return (
      <DetailDialogStory
        notice="Нет соединения. Попробуйте ещё раз."
        retry={{ label: "Повторить", onPress: noop }}
      />
    );
  },
};

/** The sheet of the compact widths: the same content in `BottomSheet`, not `Dialog`. */
export const AsBottomSheet: Story = {
  name: "As a bottom sheet",
  tags: ["!dev"],
  parameters: { docs: { story: { iframeHeight: "480px" } } },
  render: function AsBottomSheetStory() {
    return (
      <BottomSheet
        open
        title="Валюта подарка"
        closeAction={CLOSE_ACTION}
        onClose={noop}
        actions={
          <>
            <Button label="Отмена" variant="ghost" onPress={noop} />
            <Button label="Сохранить" variant="primary" onPress={noop} />
          </>
        }
      >
        <Text kind="body">Выберите валюту, в которой указана цена желания.</Text>
      </BottomSheet>
    );
  },
};

/** The sheet on a phone width with a long heading: it wraps and the gutter stays. */
export const AsBottomSheetNarrow: Story = {
  name: "Bottom sheet on a phone",
  tags: ["!dev"],
  parameters: { docs: { story: { iframeHeight: "520px" } } },
  render: function AsBottomSheetNarrowStory() {
    return (
      <BottomSheet
        open
        title="Забронировать желание «Плед из шерсти мериноса с длинной бахромой»?"
        closeAction={CLOSE_ACTION}
        onClose={noop}
        actions={
          <>
            <Button label="Отмена" variant="ghost" onPress={noop} />
            <Button label="Забронировать" variant="reserve" onPress={noop} />
          </>
        }
      >
        <Text kind="body">
          Бронь видна только вам: владелец не узнает, кто дарит.
        </Text>
      </BottomSheet>
    );
  },
  globals: { viewport: { value: "w360" } },
};
