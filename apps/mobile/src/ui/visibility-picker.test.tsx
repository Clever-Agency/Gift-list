// @vitest-environment happy-dom
import { VISIBILITIES, type GiftCard } from "@gift-list/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VisibilityPicker } from "@/ui/visibility-picker";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The same catalogue the app ships, so the copy is asserted without a copy of it. */
const app = JSON.parse(
  readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
) as {
  gift: {
    visibility: Record<GiftCard["visibility"], string>;
    visibilityPicker: { title: string; cancel: string };
  };
  giftForm: { field: { visibilityHint: Record<GiftCard["visibility"], string> } };
};

const labels = app.gift.visibility;
const picker = app.gift.visibilityPicker;

vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const app = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
  ) as Record<string, unknown>;

  function lookup(catalog: unknown, key: string, values?: Record<string, unknown>): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  return {
    useTranslations:
      (namespace: string) => (key: string, values?: Record<string, unknown>) =>
        lookup(
          namespace
            .split(".")
            .slice(1)
            .reduce<unknown>(
              (node, part) =>
                typeof node === "object" && node !== null
                  ? (node as Record<string, unknown>)[part]
                  : undefined,
              app,
            ),
          key,
          values,
        ),
  };
});

vi.mock("react-native", async () => {
  const React = await import("react");
  type ViewProps = {
    children?: React.ReactNode;
    role?: string;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    nativeID?: string;
    "aria-modal"?: boolean;
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
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessibilityState?: { checked?: boolean };
  };

  function View({
    children,
    role,
    accessibilityRole,
    accessibilityLabel,
    nativeID,
    "aria-modal": ariaModal,
    "aria-labelledby": ariaLabelledBy,
  }: ViewProps) {
    return React.createElement(
      "div",
      {
        ...(role ?? accessibilityRole ? { role: role ?? accessibilityRole } : {}),
        ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
        ...(nativeID ? { id: nativeID } : {}),
        ...(ariaModal !== undefined ? { "aria-modal": ariaModal ? "true" : "false" } : {}),
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

  function Pressable({
    children,
    onPress,
    accessibilityRole,
    accessibilityLabel,
    accessibilityState,
  }: PressableProps) {
    return React.createElement(
      "button",
      {
        type: "button",
        onClick: onPress,
        ...(accessibilityRole ? { role: accessibilityRole } : {}),
        ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
        ...(accessibilityState && "checked" in accessibilityState
          ? { "aria-checked": accessibilityState.checked ? "true" : "false" }
          : {}),
      },
      children,
    );
  }

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
  value = "PUBLIC",
  onSelect = vi.fn(),
  onClose = vi.fn(),
}: {
  visible?: boolean;
  value?: GiftCard["visibility"];
  onSelect?: (visibility: GiftCard["visibility"]) => void;
  onClose?: () => void;
} = {}) {
  await act(async () => {
    host.render(
      <VisibilityPicker
        visible={visible}
        title="Наушники"
        value={value}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
  });
  return { onSelect, onClose };
}

/**
 * Story 2.3 (`DESIGN.md` → Dialog, `EXPERIENCE.md` → Visibility chip):
 * a centered dialog with the three visibility rows, the current one checked.
 */
describe("VisibilityPicker: заголовок и радио", () => {
  it("заголовок с названием желания и диалоговая семантика", async () => {
    await render();

    const heading = container.querySelector('[role="header"]');
    expect(heading?.textContent).toBe(picker.title.replace("{title}", "Наушники"));

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    // The dialog is named by its own header, not by a copy of the title.
    expect(dialog?.getAttribute("aria-labelledby")).toBe(heading?.getAttribute("id"));
  });

  it("три radio с подписями, текущее значение checked", async () => {
    await render({ value: "FRIENDS" });

    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    expect(radios).toHaveLength(VISIBILITIES.length);
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual(
      VISIBILITIES.map((code) => labels[code]),
    );
    expect(
      radios.map((radio) => [radio.getAttribute("aria-label"), radio.getAttribute("aria-checked")]),
    ).toEqual([
      [labels.PUBLIC, "false"],
      [labels.FRIENDS, "true"],
      [labels.SECRET, "false"],
    ]);
  });

  it("выбор другого значения зовёт onSelect(code) и не закрывает диалог", async () => {
    const { onSelect, onClose } = await render({ value: "PUBLIC" });

    const friends = container.querySelector<HTMLElement>(
      `[role="radio"][aria-label="${labels.FRIENDS}"]`,
    );
    await act(async () => {
      friends?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith("FRIENDS");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("выбор текущего значения только закрывает диалог", async () => {
    const { onSelect, onClose } = await render({ value: "PUBLIC" });

    const current = container.querySelector<HTMLElement>(
      `[role="radio"][aria-label="${labels.PUBLIC}"]`,
    );
    await act(async () => {
      current?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("VisibilityPicker: закрытие", () => {
  it("«Отмена» закрывает диалог", async () => {
    const { onClose } = await render();

    const cancel = container.querySelector<HTMLElement>(
      `[role="button"][aria-label="${picker.cancel}"]`,
    );
    expect(cancel?.textContent).toBe(picker.cancel);

    await act(async () => {
      cancel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("visible=false — ничего не рендерит", async () => {
    await render({ visible: false });

    expect(container.innerHTML).toBe("");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
