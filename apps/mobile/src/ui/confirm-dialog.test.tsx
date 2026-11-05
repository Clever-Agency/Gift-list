// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { controlByLabel, dialogElement, escape, pressScrim, settle } from "@/test/dom";
import {
  ConfirmDialog,
  type DiscardConfirmDialogProps,
  type DestructiveConfirmDialogProps,
} from "@/ui/confirm-dialog";

/** The same catalogue the app ships: «Сохранить изменения?» is `app.giftForm.discard`. */
const catalog = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../..",
      "packages/contracts/src/i18n/ru/app.json",
    ),
    "utf8",
  ),
) as {
  giftForm: { discard: { title: string; confirm: string; decline: string } };
  toast: { close: string };
};
const discard = catalog.giftForm.discard;
const closeLabel = catalog.toast.close;

vi.mock("expo-symbols", async () => {
  const React = await import("react");
  return {
    SymbolView: ({
      name,
      size,
      tintColor,
      ...rest
    }: {
      name?: { ios?: string; android?: string; web?: string };
      size?: number;
      tintColor?: string;
      "aria-hidden"?: boolean;
      accessibilityElementsHidden?: boolean;
      importantForAccessibility?: string;
    }) =>
      React.createElement("span", {
        "data-testid": "close-icon",
        "data-ios": name?.ios,
        "data-android": name?.android,
        "data-web": name?.web,
        "data-size": String(size),
        "data-tint": tintColor,
        "data-aria-hidden": String(rest["aria-hidden"] ?? ""),
        "data-elements-hidden": String(rest.accessibilityElementsHidden ?? ""),
        "data-important-for-accessibility": rest.importantForAccessibility,
      }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: Root;
let container: HTMLDivElement;
/** Elements outside the dialog: the opener focus returns to. */
const extraNodes: HTMLElement[] = [];

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
  for (const node of extraNodes) node.remove();
  extraNodes.length = 0;
});

/** The dialog is portalled out of the test container, so the whole page is the scope. */
function pageText(): string {
  return document.body.textContent ?? "";
}

/**
 * The destructive confirmation: two actions, «Отмена» is the safe one. Used by the
 * edit screen to delete a wish.
 */
async function renderConfirm(overrides: Partial<DestructiveConfirmDialogProps> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const onClosed = vi.fn();
  function element(next: Partial<DestructiveConfirmDialogProps> = {}) {
    return (
      <ConfirmDialog
        visible
        title="Удалить «Наушники»?"
        body="Желание исчезнет из вишлиста. Это нельзя отменить."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onConfirm={onConfirm}
        onCancel={onCancel}
        onClosed={onClosed}
        {...overrides}
        {...next}
      />
    );
  }
  await act(async () => {
    host.render(element());
  });
  await settle();
  return {
    onConfirm,
    onCancel,
    onClosed,
    /** The same props again, e.g. `visible={false}`: the caller closes the layer. */
    async rerender(next: Partial<DestructiveConfirmDialogProps> = {}) {
      await act(async () => {
        host.render(element(next));
      });
      await settle(300);
    },
  };
}

/** The discard step: «Сохранить» / «Не сохранять» and a close cross. */
async function renderDiscard(overrides: Partial<DiscardConfirmDialogProps> = {}) {
  const onConfirm = vi.fn();
  const onDecline = vi.fn();
  const onClose = vi.fn();
  const onClosed = vi.fn();
  function element(next: Partial<DiscardConfirmDialogProps> = {}) {
    return (
      <ConfirmDialog
        visible
        variant="discard"
        title={discard.title}
        confirmLabel={discard.confirm}
        declineLabel={discard.decline}
        closeLabel={closeLabel}
        onConfirm={onConfirm}
        onDecline={onDecline}
        onClose={onClose}
        onClosed={onClosed}
        {...overrides}
        {...next}
      />
    );
  }
  await act(async () => {
    host.render(element());
  });
  await settle();
  return {
    onConfirm,
    onDecline,
    onClose,
    onClosed,
    async rerender(next: Partial<DiscardConfirmDialogProps> = {}) {
      await act(async () => {
        host.render(element(next));
      });
      await settle(300);
    },
  };
}

function button(label: string): HTMLElement {
  const found = controlByLabel(label);
  if (!found) throw new Error(`Не найдена кнопка «${label}»`);
  return found;
}

/** The accessible name of the open layer: the element its `aria-labelledby` points at. */
function heading(): HTMLElement | null {
  const id = dialogElement()?.getAttribute("aria-labelledby");
  return id ? document.getElementById(id) : null;
}

describe("ConfirmDialog: слой и заголовок", () => {
  it("пока visible=false, ничего не рендерится", async () => {
    await renderConfirm({ visible: false });

    expect(dialogElement()).toBeNull();
    expect(pageText()).toBe("");
  });

  it("режим подтверждения: заголовок называет объект, body объясняет последствие", async () => {
    await renderConfirm();

    expect(heading()?.textContent).toBe("Удалить «Наушники»?");
    expect(pageText()).toContain("Желание исчезнет из вишлиста. Это нельзя отменить.");
    expect(pageText()).toContain("Удалить");
    expect(pageText()).toContain("Отмена");
  });

  it("подтверждение — alertdialog с aria-modal и заголовком в aria-labelledby", async () => {
    await renderConfirm();

    const layer = dialogElement();
    expect(layer?.getAttribute("role")).toBe("alertdialog");
    expect(layer?.getAttribute("aria-modal")).toBe("true");
    expect(heading()).not.toBeNull();
    // One dialog, not a card inside another one.
    expect(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).toHaveLength(1);
  });

  it("режим «несохранённые изменения»: вопрос и три действия", async () => {
    await renderDiscard();

    expect(dialogElement()?.getAttribute("role")).toBe("dialog");
    expect(heading()?.textContent).toBe(discard.title);
    expect(pageText()).toContain(discard.confirm);
    expect(pageText()).toContain(discard.decline);
    // The cross has an accessible name but no visible text.
    expect(button(closeLabel).getAttribute("aria-label")).toBe(closeLabel);
    // «Отмена» belongs to the form, not to this step.
    expect(controlByLabel("Отмена")).toBeUndefined();
  });
});

describe("ConfirmDialog: действия", () => {
  it("подтверждение: «Удалить» зовёт onConfirm", async () => {
    const { onConfirm, onCancel } = await renderConfirm();

    await act(async () => button("Удалить").click());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("подтверждение: «Отмена» зовёт onCancel и не удаляет", async () => {
    const { onConfirm, onCancel } = await renderConfirm();

    await act(async () => button("Отмена").click());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("шаг черновика: «Сохранить» и «Не сохранять» зовут свои обработчики", async () => {
    const { onConfirm, onDecline, onClose } = await renderDiscard();

    await act(async () => button(discard.confirm).click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => button(discard.decline).click());
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("шаг черновика: крестик закрывает и не сохраняет", async () => {
    const { onConfirm, onDecline, onClose } = await renderDiscard();

    await act(async () => button(closeLabel).click());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDecline).not.toHaveBeenCalled();
  });

  it("подложка закрывает слой: onCancel в подтверждении, onClose в шаге черновика", async () => {
    const confirmMode = await renderConfirm();
    await pressScrim("confirm-dialog-scrim");
    expect(confirmMode.onCancel).toHaveBeenCalledTimes(1);
    expect(confirmMode.onConfirm).not.toHaveBeenCalled();

    await act(async () => host.render(<div />));
    await settle(300);
    const discardMode = await renderDiscard();
    await pressScrim("confirm-dialog-scrim");
    expect(discardMode.onClose).toHaveBeenCalledTimes(1);
    expect(discardMode.onConfirm).not.toHaveBeenCalled();
    expect(discardMode.onDecline).not.toHaveBeenCalled();
  });

  it("Esc / системное «назад»: onCancel в подтверждении, onClose в шаге черновика", async () => {
    const confirmMode = await renderConfirm();
    await act(async () => escape());
    expect(confirmMode.onCancel).toHaveBeenCalledTimes(1);
    expect(confirmMode.onConfirm).not.toHaveBeenCalled();

    await act(async () => host.render(<div />));
    await settle(300);
    const discardMode = await renderDiscard();
    await act(async () => escape());
    expect(discardMode.onClose).toHaveBeenCalledTimes(1);
    expect(discardMode.onConfirm).not.toHaveBeenCalled();
    expect(discardMode.onDecline).not.toHaveBeenCalled();
  });
});

describe("ConfirmDialog: крестик", () => {
  it("иконка — expo-symbols, декоративная, внутри кнопки с подписью", async () => {
    await renderDiscard();

    const icon = document.querySelector('[data-testid="close-icon"]');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("data-ios")).toBe("xmark");
    expect(icon?.getAttribute("data-android")).toBe("close");
    expect(icon?.getAttribute("data-web")).toBe("close");
    expect(icon?.getAttribute("data-size")).toBe("24");
    // The button's label is the accessible name; the icon adds none.
    expect(icon?.getAttribute("data-aria-hidden")).toBe("true");
    expect(icon?.getAttribute("data-elements-hidden")).toBe("true");
    expect(icon?.getAttribute("data-important-for-accessibility")).toBe("no-hide-descendants");
    expect(button(closeLabel).contains(icon)).toBe(true);
  });
});

describe("ConfirmDialog: busy и одно нажатие на открытие", () => {
  it("busy в подтверждении: кнопка недоступна и объявлена занятой", async () => {
    const { onConfirm } = await renderConfirm({ busy: true, confirmLabel: "Удаляем…" });

    const confirm = button("Удаляем…");
    expect(confirm.textContent).toBe("Удаляем…");
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    expect(confirm.getAttribute("aria-busy")).toBe("true");

    await act(async () => confirm.click());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("busy в шаге черновика: «Сохранить» недоступна и не сохраняет", async () => {
    const { onConfirm } = await renderDiscard({ busy: true });

    const confirm = button(discard.confirm);
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    expect(confirm.getAttribute("aria-disabled")).toBe("true");

    await act(async () => confirm.click());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("двойной тап «Удалить» даёт одно действие на одно открытие", async () => {
    const { onConfirm, rerender } = await renderConfirm();

    // Both taps land in the same frame, before `visible` changes.
    await act(async () => {
      const confirm = button("Удалить");
      confirm.click();
      confirm.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // A second opening is a second question: its first press counts again.
    await rerender({ visible: false });
    await rerender();
    await act(async () => button("Удалить").click());

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("двойной тап «Сохранить» даёт одно действие на одно открытие", async () => {
    const { onConfirm, rerender } = await renderDiscard();

    await act(async () => {
      const confirm = button(discard.confirm);
      confirm.click();
      confirm.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await rerender({ visible: false });
    await rerender();
    await act(async () => button(discard.confirm).click());

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});

describe("ConfirmDialog: фокус в диалоге", () => {
  it("подложка не попадает в порядок Tab", async () => {
    await renderConfirm();

    const backdrop = document.querySelector<HTMLElement>('[data-testid="confirm-dialog-scrim"]');
    expect(backdrop).not.toBeNull();
    // A plain element without `tabindex` is not a Tab stop.
    expect(backdrop?.tabIndex).toBe(-1);
  });

  it("подтверждение открывается с фокусом на «Отмена», а не на «Удалить»", async () => {
    await renderConfirm();

    expect(document.activeElement).toBe(button("Отмена"));
  });

  it("шаг черновика открывается с фокусом на заголовке", async () => {
    await renderDiscard();

    const title = heading();
    expect(title).not.toBeNull();
    // `tabIndex={-1}`: the title is focusable for the layer, not for Tab.
    expect(title?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(title);
    expect(dialogElement()?.contains(document.activeElement)).toBe(true);
  });

  it("закрытие без открытия не трогает фокус", async () => {
    const onClosed = vi.fn();

    await renderConfirm({ visible: false, onClosed });

    expect(onClosed).not.toHaveBeenCalled();
  });
});

/**
 * Focus goes back to the opener only once the layer has really closed: `Dialog`
 * reports `onClosed` after the layer has left the tree.
 */
describe("ConfirmDialog: слой закрылся", () => {
  /** The element that opened the step, as a real button in the page. */
  function opener(): HTMLButtonElement {
    const node = document.createElement("button");
    node.textContent = "Открыть";
    document.body.appendChild(node);
    extraNodes.push(node);
    return node;
  }

  it("подтверждение: «Отмена» сообщает onClosed, когда диалога уже нет", async () => {
    const onClosed = vi.fn();
    const onCancel = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(true);

      function handleCancel() {
        onCancel();
        setOpen(false);
      }

      return (
        <ConfirmDialog
          visible={open}
          title="Удалить «Наушники»?"
          body="Желание исчезнет из вишлиста. Это нельзя отменить."
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          onConfirm={vi.fn()}
          onCancel={handleCancel}
          onClosed={onClosed}
        />
      );
    }

    await act(async () => {
      host.render(<Harness />);
    });
    await settle();
    expect(dialogElement()).not.toBeNull();
    // Opening is not closing: the report fires only after the layer is gone.
    expect(onClosed).not.toHaveBeenCalled();

    await act(async () => button("Отмена").click());
    await settle(300);

    expect(dialogElement()).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("шаг черновика: onClosed приходит, когда слой ушёл, и возвращает фокус", async () => {
    const openerNode = opener();
    const onClosed = vi.fn(() => openerNode.focus());
    const { onClose, rerender } = await renderDiscard({
      onClosed: () => onClosed(),
    });

    await act(async () => button(closeLabel).click());
    expect(onClose).toHaveBeenCalledTimes(1);
    // The caller closes the layer; the report and the focus come after it has left.
    expect(onClosed).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(openerNode);

    await rerender({ visible: false });

    expect(dialogElement()).toBeNull();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(openerNode);
  });

  it("шаг черновика: Esc тоже возвращает фокус на открывший элемент", async () => {
    const openerNode = opener();
    const onClosed = vi.fn(() => openerNode.focus());
    const { rerender } = await renderDiscard({
      onClosed: () => onClosed(),
    });

    await act(async () => escape());
    await rerender({ visible: false });

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(openerNode);
  });
});
