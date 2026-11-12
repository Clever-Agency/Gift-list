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

const alena: UserSearchCard = { displayName: "Алёна", nick: "alena", relationship: "NONE" };
const ivan: UserSearchCard = { displayName: "Иван", nick: "ivan", relationship: "OUTGOING_PENDING" };
const friend: UserSearchCard = { displayName: "Фёдор", nick: "fedor", relationship: "FRIENDS" };
const inviter: UserSearchCard = { displayName: "Глеб", nick: "gleb", relationship: "INCOMING_PENDING" };
const ownCard: UserSearchCard = { displayName: "Аня", nick: "anya", relationship: "NONE" };

let root: Root;
let container: HTMLElement;

function signedIn(account: Me = user) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? { ok: true, data: account } : { ok: true, data: { signedOut: true } },
    ),
  );
}

/** The session read, plus the answers of the invite paths a test exercises. */
function signedInWith(table: Record<string, unknown>, account: Me = user) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me"
        ? { ok: true, data: account }
        : (table[path] ?? { ok: true, data: { signedOut: true } }),
    ),
  );
}

function actionCalls(path: string): unknown[][] {
  return api.apiRequest.mock.calls.filter(([called]) => called === path);
}

function testId(id: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
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

function button(label: string): HTMLElement | undefined {
  return Array.from(
    container.querySelectorAll<HTMLElement>('button, [role="button"]'),
  ).find((node) => (node.textContent ?? "").includes(label));
}

function press(label: string) {
  const target = button(label);
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

describe("поиск: отношение и действия (CLE-89)", () => {
  it("свой профиль: chip «Это вы» и никаких действий", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [ownCard] });
    await mount();

    await type("аня");
    await settle();

    expect(text()).toContain("Это вы");
    expect(testId("search-relationship-chip")).not.toBeNull();
    expect(testId("search-add-friend")).toBeNull();
    expect(button("Добавить в друзья")).toBeUndefined();
  });

  it("нет связи: кнопка зовёт sendFriendInvite, не открывает профиль и даёт оптимистичный chip", async () => {
    signedInWith({
      "/api/v1/u/alena/invite": { ok: true, data: { outcome: "INVITED" } },
    });
    search.searchUsers.mockResolvedValue({ ok: true, users: [alena] });
    await mount();

    await type("ал");
    await settle();

    expect(testId("search-add-friend")).not.toBeNull();
    // The button is a sibling of the profile link, not a child of `<a>`.
    expect(container.querySelectorAll("a button")).toHaveLength(0);

    await pressLabel("Добавить в друзья");

    expect(actionCalls("/api/v1/u/alena/invite")).toHaveLength(1);
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/alena/invite", { method: "POST" });
    expect(text()).toContain("Ожидает ответа");
    expect(text()).toContain("Приглашение отправлено");
    expect(testId("search-add-friend")).toBeNull();
    expect(links.pressed).toHaveLength(0);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("друзья и исходящее приглашение: только chip, без кнопки", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [friend, ivan] });
    await mount();

    await type("ф");
    await settle();

    expect(text()).toContain("Друзья");
    expect(text()).toContain("Ожидает ответа");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
  });

  it("отклонённое приглашение: chip «Отклонено», без кнопки", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({
      ok: true,
      users: [
        {
          displayName: "Дарья",
          nick: "darya",
          relationship: "NONE",
          inviteCooldown: { hours: 3, rejected: true },
        },
      ],
    });
    await mount();

    await type("да");
    await settle();

    expect(text()).toContain("Отклонено");
    expect(button("Добавить в друзья")).toBeUndefined();
  });

  it("живой cooldown без «Отклонено»: выключенная кнопка и часы", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({
      ok: true,
      users: [
        {
          displayName: "Дарья",
          nick: "darya",
          relationship: "NONE",
          inviteCooldown: { hours: 5, rejected: false },
        },
      ],
    });
    await mount();

    await type("да");
    await settle();

    const add = testId("search-add-friend");
    expect(add).not.toBeNull();
    expect(add?.getAttribute("aria-disabled")).toBe("true");
    expect(testId("search-invite-cooldown")?.textContent).toBe("Можно снова через 5 ч");
  });

  it("входящее приглашение: «Принять приглашение» зовёт accept и даёт дружбу", async () => {
    signedInWith({
      "/api/v1/u/gleb/invite/accept": { ok: true, data: { outcome: "FRIENDS_CREATED" } },
    });
    search.searchUsers.mockResolvedValue({ ok: true, users: [inviter] });
    await mount();

    await type("гл");
    await settle();

    expect(text()).toContain("Зовёт в друзья");
    expect(testId("search-accept-invite")).not.toBeNull();

    await pressLabel("Принять приглашение");

    expect(actionCalls("/api/v1/u/gleb/invite/accept")).toHaveLength(1);
    expect(actionCalls("/api/v1/u/gleb/invite")).toHaveLength(0);
    expect(text()).toContain("Друзья");
    expect(text()).toContain("Глеб теперь в друзьях");
    expect(button("Принять приглашение")).toBeUndefined();
  });

  it("входящее приглашение: «Отклонить» зовёт reject и оставляет cooldown", async () => {
    signedInWith({
      "/api/v1/u/gleb/invite/reject": { ok: true, data: { outcome: "REJECTED" } },
    });
    search.searchUsers.mockResolvedValue({ ok: true, users: [inviter] });
    await mount();

    await type("гл");
    await settle();

    await pressLabel("Отклонить");

    expect(actionCalls("/api/v1/u/gleb/invite/reject")).toHaveLength(1);
    expect(text()).toContain("Можно снова через 24 ч");
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();
    expect(testId("search-add-friend")?.getAttribute("aria-disabled")).toBe("true");
  });

  it("FORBIDDEN показывает ту же ошибку, что профиль, и откатывает chip", async () => {
    signedInWith({
      "/api/v1/u/alena/invite": { ok: false, code: "FORBIDDEN", message: "" },
    });
    search.searchUsers.mockResolvedValue({ ok: true, users: [alena] });
    await mount();

    await type("ал");
    await settle();

    await pressLabel("Добавить в друзья");

    expect(text()).toContain("Нет доступа.");
    expect(testId("search-add-friend")).not.toBeNull();
    expect(testId("search-add-friend")?.getAttribute("aria-disabled")).toBe("false");
  });

  it("INVITE_COOLDOWN: часы из ответа в тосте и на карточке, без чтения профиля", async () => {
    signedInWith({
      "/api/v1/u/alena/invite": {
        ok: false,
        code: "RATE_LIMITED",
        reason: "INVITE_COOLDOWN",
        message: "",
        params: { hours: 7 },
      },
    });
    search.searchUsers.mockResolvedValue({ ok: true, users: [alena] });
    await mount();

    await type("ал");
    await settle();

    await pressLabel("Добавить в друзья");

    expect(text()).toContain("Можно снова через 7 ч");
    expect(testId("search-invite-cooldown")?.textContent).toBe("Можно снова через 7 ч");
    expect(testId("search-add-friend")?.getAttribute("aria-disabled")).toBe("true");
    // The invite answer carries no profile: no `/u/:nick` read follows (NFR-3).
    expect(actionCalls("/api/v1/u/alena")).toHaveLength(0);
    expect(search.searchUsers).toHaveBeenCalledTimes(1);
  });

  it("ссылка-строка по-прежнему ведёт на профиль, даже рядом с кнопками", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [inviter] });
    await mount();

    await type("гл");
    await settle();

    const link = container.querySelector<HTMLAnchorElement>('a[href="/u/gleb"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("aria-label")).toBe("Открыть профиль @gleb");

    await act(async () => {
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(links.pressed).toEqual(["/u/gleb"]);
  });
});

/**
 * Story 4.6 / CLE-70 F1: the search row carries the profile's one-way switch
 * next to the friend action — for «нет связи» and for a pending invite, hidden
 * for the viewer's own card and for a friend (EXPERIENCE L159–175). The press
 * writes one directed edge and never reads the profile or the wishlist.
 */
describe("поиск: подписка (Story 4.6, CLE-70 F1)", () => {
  it("нет связи: «Подписаться» рядом с «Добавить в друзья», POST и оптимистичное «Отписаться»", async () => {
    signedInWith({
      "/api/v1/u/alena/subscription": { ok: true, data: { outcome: "SUBSCRIBED" } },
    });
    search.searchUsers.mockResolvedValue({ ok: true, users: [alena] });
    await mount();

    await type("ал");
    await settle();

    expect(button("Добавить в друзья")).toBeDefined();
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(testId("search-subscription")).not.toBeNull();
    // The switch is a sibling of the profile link, never a child of `<a>`.
    expect(container.querySelectorAll("a button")).toHaveLength(0);

    await pressLabel("Подписаться");

    expect(actionCalls("/api/v1/u/alena/subscription")).toHaveLength(1);
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/alena/subscription", {
      method: "POST",
    });
    expect(text()).toContain("Вы подписались");
    expect(button("Отписаться")).toBeDefined();
    expect(button("Подписаться")).toBeUndefined();
    expect(button("Добавить в друзья")).toBeDefined();
    // A subscription opens PUBLIC only, so no profile read follows (NFR-3).
    expect(actionCalls("/api/v1/u/alena")).toHaveLength(0);
  });

  it("уже подписан: «Отписаться» шлёт DELETE и возвращает «Подписаться»", async () => {
    signedInWith({
      "/api/v1/u/alena/subscription": { ok: true, data: { outcome: "UNSUBSCRIBED" } },
    });
    search.searchUsers.mockResolvedValue({ ok: true, users: [{ ...alena, subscribed: true }] });
    await mount();

    await type("ал");
    await settle();

    expect(button("Отписаться")).toBeDefined();
    expect(button("Подписаться")).toBeUndefined();

    await pressLabel("Отписаться");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/alena/subscription", {
      method: "DELETE",
    });
    expect(text()).toContain("Вы отписались");
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
  });

  it("pending приглашение: подписка остаётся рядом с чипом", async () => {
    signedInWith({
      "/api/v1/u/ivan/subscription": { ok: true, data: { outcome: "SUBSCRIBED" } },
    });
    search.searchUsers.mockResolvedValue({ ok: true, users: [{ ...ivan, subscribed: false }] });
    await mount();

    await type("ив");
    await settle();

    expect(text()).toContain("Ожидает ответа");
    expect(button("Подписаться")).toBeDefined();

    await pressLabel("Подписаться");

    expect(actionCalls("/api/v1/u/ivan/subscription")).toHaveLength(1);
    expect(text()).toContain("Ожидает ответа");
    expect(button("Отписаться")).toBeDefined();
  });

  it("входящее приглашение: подписка рядом с «Принять приглашение»", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [inviter] });
    await mount();

    await type("гл");
    await settle();

    expect(button("Принять приглашение")).toBeDefined();
    expect(button("Подписаться")).toBeDefined();
  });

  it("друзья и свой профиль: кнопки подписки нет", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({ ok: true, users: [friend, ownCard] });
    await mount();

    await type("ф");
    await settle();

    expect(text()).toContain("Друзья");
    expect(text()).toContain("Это вы");
    expect(testId("search-subscription")).toBeNull();
    expect(button("Подписаться")).toBeUndefined();
    expect(button("Отписаться")).toBeUndefined();
  });

  it("живой cooldown: подписка остаётся рядом с выключенной кнопкой дружбы", async () => {
    signedIn();
    search.searchUsers.mockResolvedValue({
      ok: true,
      users: [
        {
          displayName: "Дарья",
          nick: "darya",
          relationship: "NONE",
          inviteCooldown: { hours: 5, rejected: false },
          subscribed: true,
        },
      ],
    });
    await mount();

    await type("да");
    await settle();

    expect(testId("search-add-friend")?.getAttribute("aria-disabled")).toBe("true");
    expect(button("Отписаться")).toBeDefined();
  });

  it("сеть: подписка откатывается, кнопка возвращается, тост остаётся", async () => {
    signedInWith({ "/api/v1/u/alena/subscription": { ok: false, network: true } });
    search.searchUsers.mockResolvedValue({ ok: true, users: [alena] });
    await mount();

    await type("ал");
    await settle();

    await pressLabel("Подписаться");

    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(text()).not.toContain("Вы подписались");
  });
});
