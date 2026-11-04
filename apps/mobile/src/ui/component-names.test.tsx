// @vitest-environment happy-dom
/// <reference types="vite/client" />
import type { GiftCard } from "@gift-list/contracts";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { GhostButton } from "@/ui/ghost-button";
import { WishCard } from "@/ui/gift-card";
import { GiftForm } from "@/ui/gift-form";
import { PrimaryButton } from "@/ui/primary-button";
import { TextField } from "@/ui/text-field";
import { ToastHost } from "@/ui/toast";
import { VisibilityChip } from "@/ui/visibility-chip";
import { VisibilityPicker } from "@/ui/visibility-picker";

/**
 * CLE-64: «в React DevTools нет `Anonymous` для наших компонентов». DevTools takes
 * the name from the fiber type: a named function declaration, `displayName`, or
 * (for `forwardRef` / `memo`) the name of the wrapped render function. Every
 * component exported from `src/ui` is checked below, and the key ones are really
 * rendered — the review scenario is the info toast «Изменения сохранены.».
 */

/** The platform modules the UI imports; the test only needs the host tree, not layout. */
vi.mock("react-native", async () => {
  const React = await import("react");

  type Props = Record<string, unknown> & { children?: React.ReactNode };

  /** React Native props that map to the DOM on react-native-web, kept for a readable tree. */
  function domProps(props: Props): Record<string, unknown> {
    const {
      testID,
      nativeID,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      onPress,
      onPointerEnter,
      onPointerLeave,
      style,
      children,
      ...rest
    } = props;
    void style;
    void children;

    const dom: Record<string, unknown> = {};
    if (testID) dom["data-testid"] = testID;
    if (nativeID) dom.id = nativeID;
    if (accessibilityRole) dom.role = accessibilityRole;
    if (accessibilityLabel) dom["aria-label"] = accessibilityLabel;
    if (onPress) dom.onClick = onPress;
    if (onPointerEnter) dom.onPointerOver = onPointerEnter;
    if (onPointerLeave) dom.onPointerOut = onPointerLeave;
    const state = accessibilityState as Record<string, unknown> | undefined;
    if (state && "selected" in state) {
      dom["aria-selected"] = state.selected ? "true" : "false";
    }
    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith("aria-") || key === "tabIndex" || key === "href") dom[key] = value;
    }
    return dom;
  }

  /** A host of the platform; its own name is never part of the assertions. */
  function host(tag: "div" | "span" | "button") {
    function Host({ children, ...props }: Props) {
      return React.createElement(tag, domProps(props), children);
    }
    Host.displayName = `Host(${tag})`;
    return Host;
  }

  const View = host("div");
  const Text = host("span");
  const Pressable = host("button");
  const ScrollView = host("div");

  function TextInput({
    value,
    onChangeText,
    accessibilityLabel,
    placeholder,
    maxLength,
  }: {
    value?: string;
    onChangeText?: (value: string) => void;
    accessibilityLabel?: string;
    placeholder?: string;
    maxLength?: number;
  }) {
    return React.createElement("input", {
      value: value ?? "",
      "aria-label": accessibilityLabel,
      placeholder,
      maxLength,
      onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
    });
  }

  function Modal({ visible, children }: { visible?: boolean; children?: React.ReactNode }) {
    return visible ? React.createElement(React.Fragment, null, children) : null;
  }

  return {
    AccessibilityInfo: {
      announceForAccessibility: () => {},
      setAccessibilityFocus: () => {},
      isScreenReaderEnabled: () => Promise.resolve(false),
    },
    findNodeHandle: () => null,
    Modal,
    Platform: { OS: "web", select: (options: Record<string, unknown>) => options.web },
    Pressable,
    ScrollView,
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
    Text,
    TextInput,
    useWindowDimensions: () => ({ width: 1024, height: 768, scale: 1, fontScale: 1 }),
    View,
  };
});

vi.mock("expo-symbols", async () => {
  const React = await import("react");
  function SymbolView() {
    return React.createElement("span", { "data-testid": "symbol" });
  }
  return { SymbolView };
});

vi.mock("expo-linking", () => ({ openURL: () => Promise.resolve() }));

vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  function SafeAreaView({ children }: { children?: React.ReactNode }) {
    return React.createElement("div", null, children);
  }
  return { SafeAreaView };
});

/** The copy is not under test here: a key stands for its own string. */
vi.mock("use-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "ru",
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ExportedComponent = {
  /** `./toast.tsx` */
  module: string;
  exportName: string;
  name: string;
};

const modules = import.meta.glob(["./*.tsx", "!./*.test.tsx"], {
  eager: true,
}) as Record<string, Record<string, unknown>>;

const FORWARD_REF = Symbol.for("react.forward_ref");
const MEMO = Symbol.for("react.memo");

/** An export that React can mount: a function or a `forwardRef` / `memo` wrapper. */
function isComponentExport(exportName: string, value: unknown): boolean {
  if (typeof value === "function") {
    // Exported helpers (`toastDurationMs`, `pageGutter`) are functions too.
    return exportName === "default" || /^[A-Z]/.test(exportName);
  }
  if (typeof value !== "object" || value === null) return false;
  const type = (value as { $$typeof?: unknown }).$$typeof;
  return type === FORWARD_REF || type === MEMO;
}

/** The name DevTools shows: `displayName`, then the function / render name. */
function componentName(value: unknown): string {
  if (typeof value === "function") {
    const fn = value as { displayName?: string; name?: string };
    const name = fn.displayName || fn.name || "";
    return name === "default" || name === "Anonymous" ? "" : name;
  }
  if (typeof value === "object" && value !== null) {
    const outer = value as { displayName?: string; render?: unknown; type?: unknown };
    if (outer.displayName) return outer.displayName;
    return componentName(outer.render ?? outer.type);
  }
  return "";
}

const components: ExportedComponent[] = Object.entries(modules).flatMap(([module, exports]) =>
  Object.entries(exports).flatMap(([exportName, value]) =>
    isComponentExport(exportName, value)
      ? [{ module, exportName, name: componentName(value) }]
      : [],
  ),
);

function gift(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "g1",
    title: "Плед",
    description: null,
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

function noop() {}

/** Key components from the task, each with the props it needs to mount. */
const samples: { name: string; element: ReactElement }[] = [
  {
    name: "ToastHost",
    element: <ToastHost message="Изменения сохранены." tone="info" onDismiss={noop} />,
  },
  {
    name: "ConfirmDialog",
    element: (
      <ConfirmDialog
        visible
        title="Удалить «Плед»?"
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onConfirm={noop}
        onCancel={noop}
        onClosed={noop}
      />
    ),
  },
  { name: "WishCard", element: <WishCard gift={gift()} width={343} /> },
  { name: "VisibilityChip", element: <VisibilityChip visibility="PUBLIC" onPress={noop} /> },
  {
    name: "VisibilityPicker",
    element: (
      <VisibilityPicker
        visible
        title="Плед"
        value="PUBLIC"
        onSelect={noop}
        onClose={noop}
        onClosed={noop}
      />
    ),
  },
  { name: "GhostButton", element: <GhostButton label="Отмена" onPress={noop} /> },
  { name: "PrimaryButton", element: <PrimaryButton label="Сохранить" onPress={noop} /> },
  { name: "GiftForm", element: <GiftForm submitting={false} onSubmit={noop} /> },
  {
    name: "TextField",
    element: <TextField label="Название" value="" onChangeText={noop} input={{}} />,
  },
];

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

describe("CLE-64: имена компонентов в src/ui", () => {
  it("находит экспорты компонентов, а не пустой список", () => {
    expect(components.length).toBeGreaterThan(0);
    expect(components.map((component) => component.name)).toEqual(
      expect.arrayContaining([
        "ToastHost",
        "ConfirmDialog",
        "WishCard",
        "VisibilityChip",
        "VisibilityPicker",
        "GhostButton",
        "PrimaryButton",
        "GiftForm",
        "TextField",
      ]),
    );
  });

  it("у каждого экспортированного компонента есть непустое имя", () => {
    const anonymous = components
      .filter((component) => component.name.trim() === "")
      .map((component) => `${component.module} → ${component.exportName}`);

    expect(anonymous).toEqual([]);
  });

  it.each(samples)("$name рендерится в дерево React", async ({ name, element }) => {
    await act(async () => {
      host.render(element);
    });

    const rendered = components.find((component) => component.name === name);
    expect(rendered, `экспорт ${name}`).toBeDefined();
    expect(container.childElementCount).toBeGreaterThan(0);
  });

  it("тост «Изменения сохранены.» выводит текст под именем ToastHost", async () => {
    await act(async () => {
      host.render(<ToastHost message="Изменения сохранены." tone="info" onDismiss={noop} />);
    });

    expect(container.textContent).toContain("Изменения сохранены.");
  });
});
