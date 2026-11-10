// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { click, controlByText, settle } from "@/test/dom";
import LoginScreen from "../../app/(auth)/login";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
const search = vi.hoisted(() => ({ params: {} as Record<string, string> }));
/** UI5: happy-dom has no layout, so the scroll call is the observable effect. */
const scrollIntoView = vi.hoisted(() => vi.fn());

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
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useLocalSearchParams: () => search.params,
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

function field(label: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll<HTMLInputElement>("input")).find(
    (node) => node.getAttribute("aria-label") === label,
  );
  expect(input, `поле «${label}»`).toBeDefined();
  return input as HTMLInputElement;
}

async function press(label: string) {
  const target = controlByText(label, container);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await click(target);
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
  scrollIntoView.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
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
    expect(container.querySelector('[data-testid="page-footer"]')).not.toBeNull();
  });

  it("toast можно закрыть", async () => {
    search.params = { next: "/", reason: "session_expired" };
    await mount();

    const dismiss = controlByText("Закрыть", container);
    expect(dismiss).toBeDefined();
    await click(dismiss);
    // Тост уходит с fade (160 мс), экран убирает его после анимации.
    await settle(300);

    expect(text()).not.toContain(expiredText);
  });

  it("без reason toast не показывается", async () => {
    await mount();

    expect(text()).not.toContain(expiredText);
  });
});

describe("вход: первый невалидный (UI5)", () => {
  it("пустая форма фокусирует email, прокручивает к нему и показывает ошибку", async () => {
    await mount();

    await press("Войти");

    const email = field("Email");
    expect(document.activeElement).toBe(email);
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(scrollIntoView.mock.instances[0]).toBe(email);
    expect(text()).toContain("Проверьте введённые данные.");
  });
});
