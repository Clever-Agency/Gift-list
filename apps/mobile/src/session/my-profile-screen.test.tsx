// @vitest-environment happy-dom
import type { Me } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, settle } from "@/test/dom";
import MyProfileScreen from "../../app/(app)/(tabs)/profile";

/**
 * «Профиль» (Story 6.2): the fifth tab — a short menu, not a data screen. The
 * session gate is the same as «Настройки» (`next=/profile`), the rows lead to the
 * own profile, the settings and the author, and «Выйти» ends the session and
 * opens the login screen. «Подборок» (Story 10.1) and the full user menu of the
 * side bar (Story 6.3) are not here.
 */
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
vi.mock("expo-linking", () => ({ openURL: vi.fn(() => Promise.resolve()) }));
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
  const catalogs = { app: read("app"), common: read("common"), web: read("web") };

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
    const base =
      head === "common" ? catalogs.common : head === "web" ? catalogs.web : catalogs.app;
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
vi.mock("expo-router", () => ({
  router: navigation,
  Stack: { Screen: () => null },
}));
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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

/** `/api/v1/me` answers with the session; every other read is a successful no-op. */
function respond(session: unknown) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? session : { ok: true, data: { signedOut: true } },
    ),
  );
}

function text(): string {
  return container.textContent ?? "";
}

function button(label: string): HTMLElement | undefined {
  return controls(container).find((node) => (node.textContent ?? "").trim() === label);
}

/** A link by its visible text: «Написать в техподдержку» is a `SupportLink`, not a button. */
function link(label: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="link"]')).find(
    (node) => (node.textContent ?? "").trim() === label,
  );
}

async function press(label: string) {
  const target = button(label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <MyProfileScreen />
      </AuthProvider>,
    );
  });
  await settle(10);
}

beforeEach(() => {
  vi.clearAllMocks();
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("профиль: гейт сессии", () => {
  it("пока сессия неизвестна, показывает экран загрузки и никуда не уводит", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="session-loading"]')).not.toBeNull();
  });

  it("аноним с /profile уходит на вход с возвратом в «Профиль»", async () => {
    respond({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/profile" },
    });
    expect(text()).not.toContain("Мой профиль");
  });

  it("выход с уже погашенной сессией всё равно открывает вход", async () => {
    respond({ ok: true, data: user });
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/me"
          ? { ok: true, data: user }
          : path === "/api/v1/session"
            ? { ok: false, code: "UNAUTHENTICATED", message: "" }
            : { ok: true, data: { signedOut: true } },
      ),
    );
    await press("Выйти");

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/profile" },
    });
  });

  it("обрыв сети при проверке сессии — экран ошибки с «Повторить»", async () => {
    respond({ ok: false, network: true });
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="session-error"]')).not.toBeNull();
    expect(text()).toContain("Нет связи с сервером");
    expect(text()).toContain("Повторить");
  });
});

describe("профиль: меню", () => {
  it("заголовок «Профиль» и четыре строки: профиль, настройки, техподдержка, выход", async () => {
    respond({ ok: true, data: user });
    await mount();

    const heading = container.querySelector('[role="heading"][aria-level="1"]');
    expect(heading?.textContent).toBe("Профиль");
    expect(button("Мой профиль")).toBeDefined();
    expect(button("Настройки")).toBeDefined();
    expect(link("Написать в техподдержку")).toBeDefined();
    expect(button("Выйти")).toBeDefined();
    expect(text()).toContain("Сделано с любовью командой cleverAgency");
  });

  it("«Подборок» и уведомлений нет", async () => {
    respond({ ok: true, data: user });
    await mount();

    expect(text()).not.toContain("Подборк");
    expect(text()).not.toContain("Уведомлен");
  });

  it("«Мой профиль» открывает /u/{nick}", async () => {
    respond({ ok: true, data: user });
    await mount();

    await press("Мой профиль");
    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/u/[nick]",
      params: { nick: "anya" },
    });
  });

  it("«Настройки» открывают /settings", async () => {
    respond({ ok: true, data: user });
    await mount();

    await press("Настройки");
    expect(navigation.push).toHaveBeenCalledWith("/settings");
  });
});

describe("профиль: выход", () => {
  it("«Выйти» гасит сессию и открывает вход с возвратом в «Профиль»", async () => {
    respond({ ok: true, data: user });
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/me"
          ? { ok: true, data: user }
          : path === "/api/v1/session"
            ? { ok: true, data: { signedOut: true } }
            : { ok: true, data: { signedOut: true } },
      ),
    );
    await press("Выйти");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/session", { method: "DELETE" });
    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/profile" },
    });
  });

  it("обрыв сети при выходе оставляет человека в «Профиле» и показывает toast", async () => {
    respond({ ok: true, data: user });
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/me"
          ? { ok: true, data: user }
          : path === "/api/v1/session"
            ? { ok: false, network: true }
            : { ok: true, data: { signedOut: true } },
      ),
    );
    await press("Выйти");

    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toContain("Профиль");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("на 360 px строки и выход остаются на месте", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 360,
    });
    window.dispatchEvent(new Event("resize"));
    respond({ ok: true, data: user });
    await mount();

    expect(button("Мой профиль")).toBeDefined();
    expect(button("Выйти")).toBeDefined();
  });
});
