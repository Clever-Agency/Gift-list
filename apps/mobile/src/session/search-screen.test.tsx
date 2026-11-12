// @vitest-environment happy-dom
import type { Me, UserSearchCard } from "@gift-list/contracts";
import { act, cloneElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import SearchScreen from "../../app/(app)/search";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const search = vi.hoisted(() => ({ searchUsers: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(),
}));
const links = vi.hoisted(function createLinks() {
  return { pressed: [] as string[] };
});

vi.mock("@/api/client", () => api);
vi.mock("@/api/search", () => search);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
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
vi.mock("expo-router", () => ({
  router: navigation,
  Stack: { Screen: () => null },
  // An honest `asChild`: the router's Link puts `href` and `onPress` onto its
  // only child and draws nothing of its own (a second element would give two
  // links, and the row itself draws the anchor).
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
        links.pressed.push(href);
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user: Me = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
  hideFromSearch: false,
};

const alena: UserSearchCard = { displayName: "Алёна", nick: "alena" };
const ivan: UserSearchCard = { displayName: "Иван", nick: "ivan" };

let root: Root;
let container: HTMLElement;

function signedIn(account: Me = user) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? { ok: true, data: account } : { ok: true, data: { signedOut: true } },
    ),
  );
}

function text(): string {
  return container.textContent ?? "";
}

function input(): HTMLInputElement {
  const field = container.querySelector<HTMLInputElement>('[data-testid="search-input"]');
  expect(field, "поле поиска").not.toBeNull();
  return field as HTMLInputElement;
}

/** Controlled input: set the value past React's tracker, then let React see the `input` event. */
async function type(value: string) {
  const field = input();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The debounce and the request it starts. */
async function settle(ms = 300) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function press(label: string) {
  const target = Array.from(
    container.querySelectorAll<HTMLElement>('button, [role="button"]'),
  ).find((node) => (node.textContent ?? "").includes(label));
  expect(target, `кнопка «${label}»`).not.toBeUndefined();
  return target as HTMLElement;
}

async function pressLabel(label: string) {
  const target = press(label);
  await act(async () => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** An icon-only control: its accessible name is the only text it has. */
async function pressAria(label: string) {
  const target = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  expect(target, `кнопка «${label}»`).not.toBeNull();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <SearchScreen />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  links.pressed.length = 0;
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  navigation.canGoBack.mockReturnValue(false);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("поиск: гейт сессии", () => {
  it("пока сессия неизвестна, показывает общий экран загрузки", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="session-loading"]')).not.toBeNull();
  });

  it("аноним уходит на вход с возвратом в поиск", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/search" },
    });
  });

  it("обрыв сети при проверке сессии: экран ошибки с «Повторить», без входа", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="session-error"]')).not.toBeNull();

    signedIn();
    await pressLabel("Повторить");
    expect(container.querySelector('[data-testid="search-input"]')).not.toBeNull();
  });
});

describe("поиск: до ввода", () => {
  it("показывает текст без заголовка и не дергает API", async () => {
    signedIn();
    await mount();

    expect(text()).toContain("Найдите человека по нику или имени.");
    expect(search.searchUsers).not.toHaveBeenCalled();
  });

  it("пробелы и одинокий @ — всё ещё «до ввода», без запроса", async () => {
    signedIn();
    await mount();

    await type("   ");
    await settle();
    await type("@");
    await settle();

    expect(text()).toContain("Найдите человека по нику или имени.");
    expect(search.searchUsers).not.toHaveBeenCalled();
  });
});

describe("поиск: debounce и выдача", () => {
  it("не дергает API до паузы и запрашивает один раз после 300 мс", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [alena] });
    await mount();

    await type("ал");
    expect(search.searchUsers).not.toHaveBeenCalled();

    await settle(299);
    expect(search.searchUsers).not.toHaveBeenCalled();

    await settle(1);
    expect(search.searchUsers).toHaveBeenCalledTimes(1);
    expect(search.searchUsers).toHaveBeenCalledWith("ал");
  });

  it("показывает имя и @ник, без желаний, и ведёт настоящей ссылкой в профиль", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [alena, ivan] });
    await mount();

    await type("а");
    await settle();

    expect(text()).toContain("Алёна");
    expect(text()).toContain("@alena");
    expect(text()).toContain("Иван");
    expect(text()).toContain("@ivan");
    expect(text()).not.toContain("Плед");
    expect(text()).not.toContain("Открыт");
    expect(container.querySelectorAll('[data-testid="wish-card"]')).toHaveLength(0);

    const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(anchors.map((anchor) => anchor.getAttribute("href"))).toEqual(["/u/alena", "/u/ivan"]);
    expect(container.querySelectorAll("a a")).toHaveLength(0);

    const link = container.querySelector<HTMLAnchorElement>('a[href="/u/alena"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("role")).toBe("link");
    expect(link?.getAttribute("aria-label")).toBe("Открыть профиль @alena");

    await act(async () => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(links.pressed).toEqual(["/u/alena"]);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("@ в поле не попадает в запрос", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [alena] });
    await mount();

    await type("@alena");
    await settle();

    expect(search.searchUsers).toHaveBeenCalledWith("alena");
  });

  it("0 результатов — пустое состояние, не ошибка", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [] });
    await mount();

    await type("никого");
    await settle();

    expect(text()).toContain("Никого не нашли");
    expect(text()).toContain(
      "Проверьте ник или имя. Скрытых из поиска можно открыть только по ссылке.",
    );
    expect(text()).not.toContain("Повторить");
  });

  it("загрузка — skeleton с именованным busy-регионом", async () => {
    signedIn();
    search.searchUsers.mockReturnValue(new Promise(() => {}));
    await mount();

    await type("ал");
    await settle();

    const loading = container.querySelector('[data-testid="search-loading"]');
    expect(loading).not.toBeNull();
    expect(loading?.getAttribute("aria-busy")).toBe("true");
    expect(loading?.getAttribute("aria-label")).toBe("Ищем людей");
    expect(container.querySelectorAll('[data-testid="person-row-skeleton"]')).toHaveLength(3);
  });

  it("ошибка сети — «Повторить» повторяет тот же запрос", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("ал");
    await settle();
    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).toContain("Повторить");

    search.searchUsers.mockResolvedValue({ ok: true, users: [alena] });
    await pressLabel("Повторить");

    expect(search.searchUsers).toHaveBeenCalledTimes(2);
    expect(text()).toContain("Алёна");
  });

  it("невалидное тело — общий текст ошибки, не «нет сети»", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: false, invalid: true });
    await mount();

    await type("ал");
    await settle();

    expect(text()).toContain("Не получилось загрузить. Попробуйте ещё раз.");
  });

  it("очистка поля возвращает «до ввода» и не шлёт лишний запрос", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [alena] });
    await mount();

    await type("ал");
    await settle();
    expect(text()).toContain("Алёна");

    await pressAria("Очистить");

    expect(input().value).toBe("");
    expect(text()).toContain("Найдите человека по нику или имени.");
    expect(text()).not.toContain("Алёна");
    expect(search.searchUsers).toHaveBeenCalledTimes(1);
  });

  it("устаревший ответ не перетирает более новый", async () => {
    signedIn();
    let resolveFirst!: (value: unknown) => void;
    search.searchUsers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    search.searchUsers.mockResolvedValueOnce({ ok: true, users: [ivan] });
    await mount();

    await type("ал");
    await settle();
    await type("иван");
    await settle();
    expect(text()).toContain("Иван");

    await act(async () => {
      resolveFirst({ ok: true, users: [alena] });
      await Promise.resolve();
    });

    expect(text()).toContain("Иван");
    expect(text()).not.toContain("Алёна");
  });

  it("401: чистит сессию и уходит на вход с причиной", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });
    await mount();

    await type("ал");
    await settle();

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/search", reason: "session_expired" },
    });
  });
});
