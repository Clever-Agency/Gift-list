// @vitest-environment happy-dom
import { formatDate, formatPrice } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import HomeScreen from "../../app/(app)/index";

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
  const app = JSON.parse(readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8")) as Record<
    string,
    unknown
  >;
  const common = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/common.json"), "utf8"),
  ) as Record<string, unknown>;

  function lookup(catalog: Record<string, unknown>, key: string, values?: Record<string, unknown>): string {
    let node: unknown = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  return {
    useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
      lookup(namespace === "common" ? common : app, key, values),
    useLocale: () => "ru",
  };
});
vi.mock("expo-router", () => ({
  router: navigation,
  Stack: { Screen: () => null },
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
    View: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        "button",
        { type: "button", "aria-label": accessibilityLabel, onClick: onPress },
        children,
      ),
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
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

function expectNoSmoke() {
  expect(text()).not.toContain("желание");
  expect(text()).not.toContain("Контракт на месте");
  expect(text()).not.toContain("задан");
  expect(text()).not.toContain("Войти");
  expect(text()).not.toContain("Регистрация");
  expect(text()).not.toContain("Алёна");
  expect(text()).not.toContain(formatDate("2026-10-31", "ru"));
  expect(text()).not.toContain(formatPrice(1050, "BYN", "ru"));
  expect(text()).not.toContain(formatPrice(250000, "RUB", "ru"));
}

async function pressLogout() {
  const button = container.querySelector("button");
  expect(button?.textContent).toContain("Выйти");
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <HomeScreen />
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

describe("главный экран: гейт сессии", () => {
  it("пока сессия неизвестна, не показывает заглушку и не уходит со страницы", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toBe("");
  });

  it("аноним с / уходит на вход с возвратом на главную, без smoke", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });
    await mount();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/" },
    });
    expect(text()).not.toContain("Мой вишлист");
    expectNoSmoke();
  });

  it("вошедший видит заглушку без smoke; после «Выйти» попадает на вход", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toContain("Gift List");
    expect(text()).toContain("Мой вишлист");
    expect(text()).toContain("Выйти");
    expect(text()).toContain("Написать автору");
    expectNoSmoke();

    api.apiRequest.mockResolvedValue({ ok: true, data: { signedOut: true } });
    await pressLogout();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/" },
    });
    expect(text()).not.toContain("Мой вишлист");
  });

  it("если выход не удался из‑за сети, человек остаётся на заглушке", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    await pressLogout();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toContain("Мой вишлист");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("обрыв сети при проверке сессии тоже уводит на вход", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    await mount();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/" },
    });
    expectNoSmoke();
  });

  it("выход при уже погашенной сессии всё равно открывает вход", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });
    await pressLogout();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/" },
    });
  });
});
