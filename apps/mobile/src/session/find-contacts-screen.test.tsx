// @vitest-environment happy-dom
import type { Me } from "@gift-list/contracts";
import { act, cloneElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, settle, typeInto } from "@/test/dom";

let FindContactsScreen: typeof import("../../app/(app)/friends/contacts").default;

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(),
}));
/** A JS width a test hands the screen instead of the one `clientWidth` reports. */
const dimensions = vi.hoisted(() => ({ width: null as number | null }));

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => ({ deviceTimeZone: () => "Europe/Minsk" }));
// The shared layers draw their close cross with `expo-symbols`, which loads a
// symbol font through the `expo` runtime; the icon is decorative here.
vi.mock("expo-symbols", async () => {
  const React = await import("react");
  return {
    SymbolView: function SymbolView() {
      return React.createElement("span", { "aria-hidden": true });
    },
  };
});
vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  function useWindowDimensions() {
    const size = actual.useWindowDimensions();
    return dimensions.width === null ? size : { ...size, width: dimensions.width };
  }
  return { ...actual, useWindowDimensions };
});
vi.mock("expo-router", () => ({
  router: navigation,
  Stack: { Screen: () => null },
  Link: function Link({
    href,
    asChild,
    children,
  }: {
    href: string;
    asChild?: boolean;
    children: ReactElement<Record<string, unknown>>;
  }) {
    if (!asChild) return <a href={href}>{children}</a>;
    return cloneElement(children, {
      href,
      onPress: function onPress() {
        navigation.push(href);
      },
    });
  },
}));
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
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

  function lookup(catalog: unknown, key: string): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : key;
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
      (namespace: string) => (key: string) => lookup(catalogFor(namespace), key),
    useLocale: () => "ru",
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user: Me = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
  hideFromSearch: false,
};

let root: Root;
let container: HTMLElement;

function signedIn() {
  api.apiRequest.mockResolvedValue({ ok: true, data: user });
}

function text(): string {
  return document.body.textContent ?? "";
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <FindContactsScreen />
      </AuthProvider>,
    );
  });
  await settle(10);
}

async function press(label: string) {
  const target = controls(container).find((node) => (node.textContent ?? "").trim() === label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

beforeEach(async () => {
  vi.resetAllMocks();
  dimensions.width = null;
  window.localStorage.clear();
  navigation.canGoBack.mockReturnValue(false);
  ({ default: FindContactsScreen } = await import("../../app/(app)/friends/contacts"));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
});

describe("«Найти знакомых» в браузере", () => {
  it("аноним уходит на вход с возвратом на этот экран", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/friends/contacts" },
    });
  });

  it("объясняет, что сверки контактов в браузере нет, и даёт поиск по нику", async () => {
    signedIn();
    await mount();

    expect(text()).toContain("Найти знакомых");
    expect(text()).toContain(
      "Сверка с контактами работает в приложении на телефоне. Здесь можно найти человека по нику или имени.",
    );
    expect(container.querySelector('[data-testid="find-contacts-search"]')).not.toBeNull();
  });

  /** UX-DR11: below wide the hint is a card at the top of the screen. */
  it("на узком окне рисует подсказку установки вверху", async () => {
    dimensions.width = 360;
    signedIn();
    vi.stubEnv("EXPO_PUBLIC_ANDROID_STORE_URL", "https://play.google.com/store/apps/details?id=app.giftlist.mobile");
    vi.stubEnv("EXPO_PUBLIC_IOS_STORE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_IOS_APP_PUBLISHED", "");
    await mount();

    const hint = container.querySelector<HTMLElement>('[data-testid="install-hint"]');
    const heading = container.querySelector<HTMLElement>('[role="heading"][aria-level="1"]');
    expect(hint).not.toBeNull();
    expect(heading).not.toBeNull();
    expect(
      (heading as HTMLElement).compareDocumentPosition(hint as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("на wide подсказки нет: там её место — правая колонка корневого экрана", async () => {
    dimensions.width = 1440;
    signedIn();
    vi.stubEnv("EXPO_PUBLIC_ANDROID_STORE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_IOS_STORE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_IOS_APP_PUBLISHED", "");
    await mount();

    expect(container.querySelector('[data-testid="install-hint"]')).toBeNull();
  });

  it("поиск по нику открывает существующий /search с запросом", async () => {
    signedIn();
    await mount();

    const field = container.querySelector<HTMLInputElement>('[data-testid="find-contacts-search"]');
    expect(field).not.toBeNull();
    await typeInto(field as HTMLInputElement, "@аня");
    await press("Искать");

    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/search",
      params: { q: "аня" },
    });
  });

  it("пустой запрос открывает /search без параметра", async () => {
    signedIn();
    await mount();

    await press("Искать");
    expect(navigation.push).toHaveBeenCalledWith("/search");
  });
});
