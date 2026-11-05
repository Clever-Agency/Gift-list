// @vitest-environment happy-dom
/// <reference types="vite/client" />
import type { GiftCard } from "@gift-list/contracts";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/ui/confirm-dialog";
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
 * component exported from `src/ui` is checked below (and each `app/` screen's
 * `displayName` in the second suite), and the key ones are really rendered — the
 * review scenario is the info toast «Изменения сохранены.».
 */

vi.mock("expo-symbols", async () => {
  const React = await import("react");
  function SymbolView() {
    return React.createElement("span", { "data-testid": "symbol" });
  }
  return { SymbolView };
});

vi.mock("expo-linking", () => ({ openURL: () => Promise.resolve() }));

/**
 * The app screens are only imported for their `default` export, so these platform
 * modules stand in for the navigator, fonts and splash as they do for `react-native`
 * above: nothing renders, nothing navigates.
 */
vi.mock("expo-font", () => ({ useFonts: () => [true, null] }));

vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "ru" }],
}));

vi.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: () => Promise.resolve(),
  hideAsync: () => Promise.resolve(),
}));

vi.mock("expo-status-bar", async () => {
  const React = await import("react");
  function StatusBar() {
    return React.createElement("div");
  }
  return { StatusBar };
});

vi.mock("expo-router", async () => {
  const React = await import("react");

  function Link({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  function Screen() {
    return null;
  }
  function Stack() {
    return null;
  }
  Stack.Screen = Screen;
  function useFocusEffect() {}
  function useLocalSearchParams() {
    return {};
  }
  const router = {
    replace() {},
    push() {},
    back() {},
    canGoBack() {
      return false;
    },
    dismissTo() {},
    setParams() {},
  };

  return { Link, router, Stack, useFocusEffect, useLocalSearchParams };
});

vi.mock("expo-router/html", async () => {
  const React = await import("react");
  function ScrollViewStyleReset() {
    return React.createElement(React.Fragment, null);
  }
  return { ScrollViewStyleReset };
});

vi.mock("expo-router/react-navigation", () => ({ usePreventRemove() {} }));

vi.mock("@expo-google-fonts/lora", () => ({ Lora_600SemiBold: {} }));

vi.mock("@expo-google-fonts/manrope", () => ({
  Manrope_400Regular: {},
  Manrope_500Medium: {},
  Manrope_600SemiBold: {},
}));

vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  function SafeAreaView({ children }: { children?: React.ReactNode }) {
    return React.createElement("div", null, children);
  }
  function SafeAreaProvider({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  function useSafeAreaInsets() {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  return { SafeAreaProvider, SafeAreaView, useSafeAreaInsets };
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
  /** The string `displayName` the module sets on this export, when it does. */
  displayName?: string;
};

const modules = import.meta.glob(["./*.tsx", "!./*.test.tsx"], {
  eager: true,
}) as Record<string, Record<string, unknown>>;

/** Every screen module under `app/`, imported only for its `default` export. */
const screens = import.meta.glob(
  ["../../app/**/*.tsx", "!../../app/**/*.test.tsx"],
  { eager: true },
) as Record<string, Record<string, unknown>>;

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

/** The explicit string `displayName` of a function or a `forwardRef` / `memo` object. */
function displayNameOf(value: unknown): string | undefined {
  if (typeof value !== "function" && (typeof value !== "object" || value === null)) {
    return undefined;
  }
  const displayName = (value as { displayName?: unknown }).displayName;
  return typeof displayName === "string" ? displayName : undefined;
}

const components: ExportedComponent[] = Object.entries(modules).flatMap(([module, exports]) =>
  Object.entries(exports).flatMap(([exportName, value]) =>
    isComponentExport(exportName, value)
      ? [
          {
            module,
            exportName,
            name: componentName(value),
            displayName: displayNameOf(value),
          },
        ]
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

  it("у каждого экспортированного компонента displayName равен имени экспорта", () => {
    const withoutDisplayName = components
      .filter((component) => component.displayName !== component.exportName)
      .map(
        (component) =>
          `${component.module} → ${component.exportName}: ${component.displayName ?? "нет"}`,
      );

    expect(withoutDisplayName).toEqual([]);
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

describe("CLE-64: имена экранов app", () => {
  it("находит экраны, а не пустой список", () => {
    expect(Object.keys(screens).length).toBeGreaterThan(0);
  });

  it("у каждого экрана displayName одинаков с именем default-функции", () => {
    const withoutDisplayName = Object.entries(screens).flatMap(([module, exports]) => {
      const screen = exports.default as { displayName?: unknown; name?: unknown } | undefined;
      if (typeof screen?.name !== "string" || screen.name.length === 0) {
        return [`${module} → default: нет имени функции`];
      }
      return screen.displayName === screen.name
        ? []
        : [`${module} → displayName ${String(screen.displayName)} ≠ ${screen.name}`];
    });

    expect(withoutDisplayName).toEqual([]);
  });
});
