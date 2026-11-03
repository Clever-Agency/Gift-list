// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import LoginScreen from "../../app/(auth)/login";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
const search = vi.hoisted(() => ({ params: {} as Record<string, string> }));

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  function read(name: string): Record<string, unknown> {
    return JSON.parse(
      readFileSync(join(root, `packages/contracts/src/i18n/ru/${name}.json`), "utf8"),
    ) as Record<string, unknown>;
  }
  const catalogs = { app: read("app"), common: read("common") };

  function lookup(catalog: unknown, key: string, values?: Record<string, unknown>): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  function catalogFor(namespace: string): unknown {
    const [head, ...rest] = namespace.split(".");
    const base = head === "common" ? catalogs.common : catalogs.app;
    return rest.reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      base,
    );
  }

  return {
    useTranslations:
      (namespace: string) => (key: string, values?: Record<string, unknown>) =>
        lookup(catalogFor(namespace), key, values),
    useLocale: () => "ru",
  };
});
vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    router: navigation,
    Stack: { Screen: () => null },
    Link: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("a", { href: "#" }, children),
    useLocalSearchParams: () => search.params,
  };
});
vi.mock("react-native", async () => {
  const React = await import("react");
  type Props = { children?: React.ReactNode; testID?: string };
  const element = (tag: string) =>
    function Element({ children, testID }: Props) {
      return React.createElement(tag, testID ? { "data-testid": testID } : null, children);
    };
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    Text: element("span"),
    View: element("div"),
    ScrollView: element("div"),
    TextInput: ({
      value,
      onChangeText,
      accessibilityLabel,
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
      accessibilityLabel?: string;
    }) =>
      React.createElement("input", {
        value,
        "aria-label": accessibilityLabel,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
      }),
    Pressable: ({
      children,
      onPress,
    }: Props & { onPress?: () => void }) =>
      React.createElement("button", { type: "button", onClick: onPress }, children),
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const expiredText = "Сессия закончилась, войдите снова";

let root: Root;
let container: HTMLElement;

function text(): string {
  return container.textContent ?? "";
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  search.params = {};
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("вход: сообщение об истёкшей сессии", () => {
  it("с reason=session_expired показывает toast «Сессия закончилась»", async () => {
    search.params = { next: "/", reason: "session_expired" };
    await mount();

    expect(text()).toContain(expiredText);
    expect(text()).toContain("Вход");
  });

  it("toast можно закрыть", async () => {
    search.params = { next: "/", reason: "session_expired" };
    await mount();

    const dismiss = Array.from(container.querySelectorAll("button")).find((node) =>
      (node.textContent ?? "").includes("Закрыть"),
    );
    expect(dismiss).toBeDefined();
    await act(async () => {
      dismiss?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(text()).not.toContain(expiredText);
  });

  it("без reason toast не показывается", async () => {
    await mount();

    expect(text()).not.toContain(expiredText);
  });
});
