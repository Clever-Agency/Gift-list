// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import NewGiftScreen from "../../app/(app)/gifts/new";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

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
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      React.createElement("a", { href }, children),
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
    Pressable: element("button"),
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

const user = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
};

let root: Root;
let container: HTMLElement;

function text(): string {
  return container.textContent ?? "";
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <NewGiftScreen />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("новое желание: заглушка Story 2.2", () => {
  it("пока сессия неизвестна, ничего не показывает и не уходит со страницы", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toBe("");
  });

  it("показывает заглушку и «Назад» на главную", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();

    expect(text()).toContain("Новое желание");
    expect(text()).toContain("Скоро здесь можно будет добавить желание.");
    const back = container.querySelector("a");
    expect(back?.textContent).toBe("Назад");
    expect(back?.getAttribute("href")).toBe("/");
  });

  it("аноним уходит на вход с возвратом в форму", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/new" },
    });
    expect(text()).toBe("");
  });
});
