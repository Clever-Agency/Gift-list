// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import InviteReturnScreen from "../../app/invite/[token]";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
const search = vi.hoisted(() => ({ params: { token: "tok_1" } as Record<string, string | undefined> }));

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => ({ clearSessionToken: vi.fn() }));
vi.mock("@/session/device-time-zone", () => ({ deviceTimeZone: () => "Europe/Minsk" }));
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    router: navigation,
    Stack: { Screen: () => null },
    useLocalSearchParams: () => search.params,
    Link: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
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

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <InviteReturnScreen />
      </AuthProvider>,
    );
  });
}

function text(): string {
  return container.textContent ?? "";
}

beforeEach(() => {
  vi.resetAllMocks();
  search.params = { token: "tok_1" };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("приглашение: гейт сессии", () => {
  it("пока сессия неизвестна, показывает общий экран загрузки, а не пустую страницу", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    const region = container.querySelector('[data-testid="session-loading"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(1);
    expect(text()).not.toContain("Приглашение");
  });

  it("аноним уходит на регистрацию с возвратом к приглашению", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/register",
      params: { next: "/invite/tok_1" },
    });
    expect(container.querySelector('[data-testid="session-loading"]')).not.toBeNull();
  });

  it("после готовой сессии показывает приглашение", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="session-loading"]')).toBeNull();
    expect(text()).toContain("Приглашение");
  });
});
