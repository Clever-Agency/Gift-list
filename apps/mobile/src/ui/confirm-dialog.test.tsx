// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/ui/confirm-dialog";

vi.mock("react-native", async () => {
  const React = await import("react");
  type ViewProps = {
    children?: React.ReactNode;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    nativeID?: string;
    "aria-hidden"?: boolean;
    "aria-labelledby"?: string;
  };
  type TextProps = {
    children?: React.ReactNode;
    accessibilityRole?: string;
    nativeID?: string;
  };
  type PressableProps = {
    children?: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessibilityState?: { disabled?: boolean; busy?: boolean };
    "aria-hidden"?: boolean;
    focusable?: boolean;
    tabIndex?: number;
  };

  function View({
    children,
    accessibilityRole,
    accessibilityLabel,
    nativeID,
    "aria-labelledby": ariaLabelledBy,
  }: ViewProps) {
    return React.createElement(
      "div",
      {
        ...(accessibilityRole ? { role: accessibilityRole } : {}),
        ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
        ...(nativeID ? { id: nativeID } : {}),
        ...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {}),
      },
      children,
    );
  }

  function Text({ children, accessibilityRole, nativeID }: TextProps) {
    return React.createElement(
      "span",
      {
        ...(accessibilityRole ? { role: accessibilityRole } : {}),
        ...(nativeID ? { id: nativeID } : {}),
      },
      children,
    );
  }

  const Pressable = React.forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
    {
      children,
      onPress,
      disabled,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      "aria-hidden": ariaHidden,
      focusable,
      tabIndex,
    },
    ref,
  ) {
    return React.createElement(
      "button",
      {
        type: "button",
        ref,
        ...(tabIndex !== undefined ? { tabIndex } : {}),
        ...(ariaHidden ? { "aria-hidden": "true" } : {}),
        ...(focusable !== undefined ? { focusable: String(focusable) } : {}),
        ...(accessibilityRole ? { role: accessibilityRole } : {}),
        ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
        ...(accessibilityState?.disabled ? { "aria-disabled": "true" } : {}),
        ...(accessibilityState?.busy ? { "aria-busy": "true" } : {}),
        ...(disabled ? { disabled: true } : {}),
        onClick: onPress,
      },
      children,
    );
  });

  function Modal({
    visible,
    children,
    "aria-labelledby": ariaLabelledBy,
  }: {
    visible?: boolean;
    children?: React.ReactNode;
    "aria-labelledby"?: string;
  }) {
    if (!visible) return null;
    // react-native-web's Modal renders the dialog container itself and forwards
    // `aria-labelledby` to it.
    return React.createElement(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        ...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {}),
      },
      children,
    );
  }

  return {
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
    View,
    Text,
    Pressable,
    Modal,
    // The focus helper reads the platform; on web it only moves DOM focus.
    Platform: { OS: "web" },
    AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
    findNodeHandle: () => null,
    useWindowDimensions: () => ({ width: 1024, height: 800 }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

async function render({
  visible = true,
  busy = false,
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
}: {
  visible?: boolean;
  busy?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
} = {}) {
  await act(async () => {
    host.render(
      <ConfirmDialog
        visible={visible}
        title="Удалить «Наушники»?"
        body="Желание исчезнет из вишлиста. Это нельзя отменить."
        confirmLabel={busy ? "Удаляем…" : "Удалить"}
        cancelLabel="Отмена"
        busy={busy}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
  });
  return { onConfirm, onCancel };
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (node) => node.getAttribute("aria-label") === label,
  );
}

async function press(label: string) {
  const target = button(label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("ConfirmDialog: заголовок и текст", () => {
  it("диалог называет объект и объясняет последствие", async () => {
    await render();

    const heading = container.querySelector('[role="header"]');
    expect(heading?.textContent).toBe("Удалить «Наушники»?");
    expect(container.textContent).toContain(
      "Желание исчезнет из вишлиста. Это нельзя отменить.",
    );

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    // The dialog is named by its own header, not by a copy of the title.
    expect(dialog?.getAttribute("aria-labelledby")).toBe(heading?.getAttribute("id"));
  });
});

describe("ConfirmDialog: действия", () => {
  it("«Удалить» зовёт onConfirm", async () => {
    const { onConfirm } = await render();

    await press("Удалить");

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("«Отмена» зовёт onCancel и не удаляет", async () => {
    const { onConfirm, onCancel } = await render();

    await press("Отмена");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("busy: кнопка недоступна и объявлена занятой", async () => {
    const { onConfirm } = await render({ busy: true });

    const confirm = button("Удаляем…");
    expect(confirm?.textContent).toBe("Удаляем…");
    expect(confirm?.disabled).toBe(true);
    expect(confirm?.getAttribute("aria-disabled")).toBe("true");
    expect(confirm?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      confirm?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("visible=false — ничего не рендерит", async () => {
    await render({ visible: false });

    expect(container.innerHTML).toBe("");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});

/**
 * CLE-51: the scrim closes the dialog with a click but is not a tab stop, and
 * the alertdialog opens with focus on «Отмена», the safe action.
 */
describe("ConfirmDialog: фокус в диалоге", () => {
  it("подложка не фокусируется и не попадает в порядок Tab", async () => {
    await render();

    const scrim = container.querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(scrim).not.toBeNull();
    expect(scrim?.tabIndex).toBe(-1);
    expect(scrim?.getAttribute("focusable")).toBe("false");
  });

  it("после открытия фокус на «Отмена», а не на «Удалить»", async () => {
    await render();

    expect(document.activeElement).toBe(button("Отмена"));
  });

  it("клик по подложке по-прежнему зовёт onCancel", async () => {
    const { onConfirm, onCancel } = await render();

    const scrim = container.querySelector<HTMLElement>('[aria-hidden="true"]');
    await act(async () => {
      scrim?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
