// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { colors, rounded, spacing } from "@/theme/tokens";
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

/** Resolved styles the mock keeps for the assertions. */
const ui = vi.hoisted(() => ({
  pressableStyles: new Map<string, unknown>(),
  cardStyle: undefined as unknown,
  scrimStyle: undefined as unknown,
}));

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

vi.mock("react-native", async () => {
  const React = await import("react");
  type ChildrenProps = { children?: React.ReactNode };

  function resolveStyle(style: unknown): unknown {
    return typeof style === "function"
      ? (style as (state: { pressed: boolean }) => unknown)({ pressed: false })
      : style;
  }

  return {
    StyleSheet: { create: (styles: unknown) => styles },
    /** A header is a `span` with `role="header"`, `nativeID` is the DOM `id`. */
    Text: ({
      children,
      nativeID,
      accessibilityRole,
    }: ChildrenProps & { nativeID?: string; accessibilityRole?: string }) =>
      React.createElement(
        "span",
        {
          ...(nativeID ? { id: nativeID } : {}),
          ...(accessibilityRole ? { role: accessibilityRole } : {}),
        },
        children,
      ),
    View: ({
      ref,
      children,
      role,
      accessibilityRole,
      "aria-modal": ariaModal,
      "aria-labelledby": labelledBy,
      nativeID,
      tabIndex,
      testID,
      style,
    }: ChildrenProps & {
      ref?: React.Ref<HTMLDivElement>;
      role?: string;
      accessibilityRole?: string;
      "aria-modal"?: boolean;
      "aria-labelledby"?: string;
      nativeID?: string;
      tabIndex?: number;
      testID?: string;
      style?: unknown;
    }) => {
      if (testID === "confirm-dialog-card") ui.cardStyle = resolveStyle(style);
      return React.createElement(
        "div",
        {
          ref,
          ...(role ?? accessibilityRole ? { role: role ?? accessibilityRole } : {}),
          ...(ariaModal ? { "aria-modal": "true" } : {}),
          ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
          ...(nativeID ? { id: nativeID } : {}),
          ...(tabIndex != null ? { tabIndex } : {}),
          ...(testID ? { "data-testid": testID } : {}),
        },
        children,
      );
    },
    Pressable: ({
      ref,
      children,
      onPress,
      testID,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      disabled,
      focusable,
      tabIndex,
      "aria-hidden": ariaHidden,
      style,
    }: ChildrenProps & {
      ref?: React.Ref<HTMLButtonElement>;
      onPress?: () => void;
      testID?: string;
      accessibilityRole?: string;
      accessibilityLabel?: string;
      accessibilityState?: { disabled?: boolean; busy?: boolean };
      disabled?: boolean;
      focusable?: boolean;
      tabIndex?: number;
      "aria-hidden"?: boolean;
      style?: unknown;
    }) => {
      if (accessibilityLabel) ui.pressableStyles.set(accessibilityLabel, resolveStyle(style));
      if (testID === "confirm-dialog-scrim") ui.scrimStyle = resolveStyle(style);
      return React.createElement(
        "button",
        {
          ref,
          type: "button",
          role: accessibilityRole,
          ...(tabIndex !== undefined ? { tabIndex } : {}),
          ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
          ...(ariaHidden ? { "aria-hidden": "true" } : {}),
          ...(focusable !== undefined ? { focusable: String(focusable) } : {}),
          ...(accessibilityState?.disabled ? { "aria-disabled": "true" } : {}),
          ...(accessibilityState?.busy ? { "aria-busy": "true" } : {}),
          ...(disabled ? { disabled: true } : {}),
          // A disabled `Pressable` does not run `onPress`, same as the platform.
          ...(disabled ? {} : { onClick: () => onPress?.() }),
          ...(testID ? { "data-testid": testID } : {}),
        },
        children,
      );
    },
    /**
     * `Modal` renders nothing while hidden and mounts its children when visible.
     * It reports the end of the fade-out through `onDismiss` — on the web that is
     * the only moment focus can safely leave the layer. `onRequestClose` is the
     * Android back / Esc hook: the mock feeds it a `keydown` with `Escape`, as the
     * browser does on react-native-web.
     */
    Modal: ({
      visible,
      children,
      transparent,
      animationType,
      onDismiss,
      onRequestClose,
      "aria-labelledby": ariaLabelledBy,
    }: ChildrenProps & {
      visible?: boolean;
      transparent?: boolean;
      animationType?: string;
      onDismiss?: () => void;
      onRequestClose?: () => void;
      "aria-labelledby"?: string;
    }) => {
      // react-native-web keeps the layer until the fade-out ends and only then
      // reports `onDismiss`; here the layer is gone in the same commit.
      const wasVisible = React.useRef(visible);
      React.useEffect(() => {
        if (wasVisible.current && !visible) onDismiss?.();
        wasVisible.current = visible;
      }, [visible, onDismiss]);
      if (!visible) return null;
      // react-native-web's Modal renders the dialog container itself and forwards
      // `aria-labelledby` to it.
      return React.createElement(
        "div",
        {
          "data-testid": "modal",
          "data-transparent": String(transparent),
          "data-animation": animationType,
          role: "dialog",
          "aria-modal": "true",
          ...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {}),
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Escape") onRequestClose?.();
          },
        },
        children,
      );
    },
    // The focus helper reads the platform; on web it only moves DOM focus.
    Platform: { OS: "web" },
    AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
    findNodeHandle: () => null,
    useWindowDimensions: () => ({ width: 1024, height: 800 }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The partial props either mode accepts in the tests. */

let host: Root;
let container: HTMLDivElement;
/** Elements outside the dialog: the opener focus returns to. */
const extraNodes: HTMLElement[] = [];

beforeEach(() => {
  ui.pressableStyles.clear();
  ui.cardStyle = undefined;
  ui.scrimStyle = undefined;
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
  return {
    onConfirm,
    onCancel,
    onClosed,
    /** The same props again, e.g. `visible={false}`: the caller closes the layer. */
    async rerender(next: Partial<DestructiveConfirmDialogProps> = {}) {
      await act(async () => {
        host.render(element(next));
      });
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
  return {
    onConfirm,
    onDecline,
    onClose,
    onClosed,
    async rerender(next: Partial<DiscardConfirmDialogProps> = {}) {
      await act(async () => {
        host.render(element(next));
      });
    },
  };
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="button"]')).find(
    (node) => node.getAttribute("aria-label") === label,
  );
  if (!found) throw new Error(`Не найдена кнопка «${label}»`);
  return found;
}

function scrim(): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-scrim"]');
  if (!found) throw new Error("Не найден scrim");
  return found;
}

/** Esc reaches the dialog's `onRequestClose`, as on react-native-web. */
async function escapeDialog() {
  await act(async () => {
    container
      .querySelector('[data-testid="modal"]')
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
}

/** Style arrays are plain objects here: `StyleSheet.create` is the identity in the mock. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, part) => ({ ...acc, ...flattenStyle(part) }),
      {},
    );
  }
  return typeof style === "object" && style !== null
    ? { ...(style as Record<string, unknown>) }
    : {};
}

describe("ConfirmDialog: слой и заголовок", () => {
  it("пока visible=false, ничего не рендерится", async () => {
    await renderConfirm({ visible: false });

    expect(container.querySelector('[data-testid="modal"]')).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("режим подтверждения: заголовок называет объект, body объясняет последствие", async () => {
    await renderConfirm();

    const heading = container.querySelector('[role="header"]');
    expect(heading?.textContent).toBe("Удалить «Наушники»?");
    expect(container.textContent).toContain(
      "Желание исчезнет из вишлиста. Это нельзя отменить.",
    );
    expect(container.textContent).toContain("Удалить");
    expect(container.textContent).toContain("Отмена");
  });

  it("слой — role dialog с aria-modal и заголовком в aria-labelledby", async () => {
    await renderConfirm();

    const modal = container.querySelector('[data-testid="modal"]');
    expect(modal?.getAttribute("data-transparent")).toBe("true");
    expect(modal?.getAttribute("data-animation")).toBe("fade");

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");

    const heading = container.querySelector('[role="header"]');
    expect(dialog?.getAttribute("aria-labelledby")).toBe(heading?.getAttribute("id"));
    // One dialog, not a card inside another one.
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it("режим «несохранённые изменения»: вопрос и три действия", async () => {
    await renderDiscard();

    const heading = container.querySelector('[role="header"]');
    expect(heading?.textContent).toBe(discard.title);
    expect(container.textContent).toContain(discard.confirm);
    expect(container.textContent).toContain(discard.decline);
    // The cross has an accessible name but no visible text.
    expect(button(closeLabel).getAttribute("aria-label")).toBe(closeLabel);
    // «Отмена» belongs to the form, not to this step.
    expect(
      Array.from(container.querySelectorAll('[role="button"]')).some(
        (node) => node.textContent === "Отмена",
      ),
    ).toBe(false);
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
    await act(async () => scrim().click());
    expect(confirmMode.onCancel).toHaveBeenCalledTimes(1);
    expect(confirmMode.onConfirm).not.toHaveBeenCalled();

    await act(async () => host.render(<div />));
    ui.scrimStyle = undefined;
    const discardMode = await renderDiscard();
    await act(async () => scrim().click());
    expect(discardMode.onClose).toHaveBeenCalledTimes(1);
    expect(discardMode.onConfirm).not.toHaveBeenCalled();
    expect(discardMode.onDecline).not.toHaveBeenCalled();
  });

  it("Esc / системное «назад» (onRequestClose): onCancel в подтверждении, onClose в шаге черновика", async () => {
    const confirmMode = await renderConfirm();
    await escapeDialog();
    expect(confirmMode.onCancel).toHaveBeenCalledTimes(1);
    expect(confirmMode.onConfirm).not.toHaveBeenCalled();

    await act(async () => host.render(<div />));
    const discardMode = await renderDiscard();
    await escapeDialog();
    expect(discardMode.onClose).toHaveBeenCalledTimes(1);
    expect(discardMode.onConfirm).not.toHaveBeenCalled();
    expect(discardMode.onDecline).not.toHaveBeenCalled();
  });
});

describe("ConfirmDialog: крестик", () => {
  it("иконка — expo-symbols, декоративная, в зоне касания 44×44", async () => {
    await renderDiscard();

    const icon = container.querySelector('[data-testid="close-icon"]');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("data-ios")).toBe("xmark");
    expect(icon?.getAttribute("data-android")).toBe("close");
    expect(icon?.getAttribute("data-web")).toBe("close");
    expect(icon?.getAttribute("data-size")).toBe(String(spacing["icon-nav"]));
    expect(icon?.getAttribute("data-tint")).toBe(colors.foreground);
    // The button's label is the accessible name; the icon adds none.
    expect(icon?.getAttribute("data-aria-hidden")).toBe("true");
    expect(icon?.getAttribute("data-elements-hidden")).toBe("true");
    expect(icon?.getAttribute("data-important-for-accessibility")).toBe("no-hide-descendants");

    const style = flattenStyle(ui.pressableStyles.get(closeLabel));
    expect(style.width).toBe(spacing["touch-target"]);
    expect(style.height).toBe(spacing["touch-target"]);
  });
});

describe("ConfirmDialog: стили из токенов", () => {
  it("карточка до spacing['dialog-width'] на surface, scrim — colors.scrim", async () => {
    await renderConfirm();

    const card = flattenStyle(ui.cardStyle);
    expect(card.maxWidth).toBe(spacing["dialog-width"]);
    expect(card.backgroundColor).toBe(colors.surface);
    expect(card.borderRadius).toBe(rounded.lg);
    expect(card.padding).toBe(spacing["card-padding"]);

    const scrimStyle = flattenStyle(ui.scrimStyle);
    expect(scrimStyle.backgroundColor).toBe(colors.scrim);
    expect(scrimStyle.position).toBe("absolute");
  });

  it("«Не сохранять» залито colors.destructive, «Сохранить» — primary", async () => {
    await renderDiscard();

    const declineStyle = flattenStyle(ui.pressableStyles.get(discard.decline));
    expect(declineStyle.backgroundColor).toBe(colors.destructive);

    const confirmStyle = flattenStyle(ui.pressableStyles.get(discard.confirm));
    expect(confirmStyle.backgroundColor).toBe(colors.primary);
  });

  it("«Удалить» залито colors.destructive, «Отмена» — без фона", async () => {
    await renderConfirm();

    const confirmStyle = flattenStyle(ui.pressableStyles.get("Удалить"));
    expect(confirmStyle.backgroundColor).toBe(colors.destructive);

    const cancelStyle = flattenStyle(ui.pressableStyles.get("Отмена"));
    expect(cancelStyle.backgroundColor).toBeUndefined();
  });
});

describe("ConfirmDialog: busy и одно нажатие на открытие", () => {
  it("busy в подтверждении: кнопка недоступна и объявлена занятой", async () => {
    const { onConfirm } = await renderConfirm({ busy: true, confirmLabel: "Удаляем…" });

    const confirm = button("Удаляем…");
    expect(confirm.textContent).toBe("Удаляем…");
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    expect(confirm.getAttribute("aria-busy")).toBe("true");

    await act(async () => confirm.click());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("busy в шаге черновика: «Сохранить» недоступна и не сохраняет", async () => {
    const { onConfirm } = await renderDiscard({ busy: true });

    const confirm = button(discard.confirm);
    expect(confirm.disabled).toBe(true);
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
  it("подложка не фокусируется и не попадает в порядок Tab", async () => {
    await renderConfirm();

    const backdrop = scrim();
    expect(backdrop.tabIndex).toBe(-1);
    expect(backdrop.getAttribute("focusable")).toBe("false");
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");
  });

  it("подтверждение открывается с фокусом на «Отмена», а не на «Удалить»", async () => {
    await renderConfirm();

    expect(document.activeElement).toBe(button("Отмена"));
  });

  it("шаг черновика открывается с фокусом на заголовке", async () => {
    await renderDiscard();

    const dialog = container.querySelector('[role="dialog"]');
    const heading = container.querySelector('[role="header"]');
    expect(heading).not.toBeNull();
    // `tabIndex={-1}`: the title is focusable for the layer, not for Tab.
    expect(heading?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
    expect(dialog?.contains(document.activeElement)).toBe(true);
  });

  it("закрытие без открытия не трогает фокус", async () => {
    const onClosed = vi.fn();

    await renderConfirm({ visible: false, onClosed });

    expect(onClosed).not.toHaveBeenCalled();
  });
});

/**
 * Focus goes back to the opener only once the layer has really closed: `Modal`
 * reports `onDismiss`, `useLayerClosed` turns it into `onClosed`. An effect on
 * `visible={false}` is too early on the web (see `focus.ts`).
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
      return (
        <ConfirmDialog
          visible={open}
          title="Удалить «Наушники»?"
          body="Желание исчезнет из вишлиста. Это нельзя отменить."
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          onConfirm={vi.fn()}
          onCancel={() => {
            onCancel();
            setOpen(false);
          }}
          onClosed={onClosed}
        />
      );
    }

    await act(async () => {
      host.render(<Harness />);
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    // Opening is not closing: the report fires only after the layer is gone.
    expect(onClosed).not.toHaveBeenCalled();

    await act(async () => button("Отмена").click());

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("шаг черновика: onClosed приходит из onDismiss, а не из эффекта на visible", async () => {
    const openerNode = opener();
    const onClosed = vi.fn(() => openerNode.focus());
    const { onClose, rerender } = await renderDiscard({
      onClosed: () => onClosed(),
    });

    await act(async () => button(closeLabel).click());
    expect(onClose).toHaveBeenCalledTimes(1);
    // The caller closed the layer; the report and the focus come after the fade-out.
    expect(onClosed).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(openerNode);

    await rerender({ visible: false });

    // On the web `useLayerClosed` ignores the `visible` effect and waits for
    // `Modal`'s `onDismiss`, which the mock reports once the layer has left.
    expect(container.querySelector('[data-testid="modal"]')).toBeNull();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(openerNode);
  });

  it("шаг черновика: Esc тоже возвращает фокус на открывший элемент", async () => {
    const openerNode = opener();
    const onClosed = vi.fn(() => openerNode.focus());
    const { rerender } = await renderDiscard({
      onClosed: () => onClosed(),
    });

    await escapeDialog();
    await rerender({ visible: false });

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(openerNode);
  });
});
