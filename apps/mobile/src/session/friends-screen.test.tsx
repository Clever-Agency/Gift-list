// @vitest-environment happy-dom
import { PRODUCT_NAME, type CircleCard, type Me } from "@gift-list/contracts";
import { act, cloneElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscriptionViewKey } from "@/friends/subscription-view.types";
import { InviteBadgeProvider } from "@/navigation/invite-badge";
import { AuthProvider } from "@/session/auth-context";
import FriendsScreen from "../../app/(app)/(tabs)/friends";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const circle = vi.hoisted(() => ({
  fetchFriends: vi.fn(),
  fetchInvites: vi.fn(),
  fetchSubscribers: vi.fn(),
  fetchSubscriptions: vi.fn(),
  cancelFriendInvite: vi.fn(),
  removeFriend: vi.fn(),
  removeSubscriber: vi.fn(),
}));
const invites = vi.hoisted(() => ({
  sendFriendInvite: vi.fn(),
  acceptFriendInvite: vi.fn(),
  rejectFriendInvite: vi.fn(),
}));
const subscription = vi.hoisted(() => ({
  subscribeToNick: vi.fn(),
  unsubscribeFromNick: vi.fn(),
}));
const block = vi.hoisted(() => ({ blockUser: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(),
}));

vi.mock("@/api/client", () => api);
vi.mock("@/api/circle", () => circle);
vi.mock("@/api/friend-invite", () => invites);
vi.mock("@/api/subscription", () => subscription);
vi.mock("@/api/block", () => block);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
// The confirm dialog draws its close cross with `expo-symbols`, which loads a
// symbol font at runtime; the icon is decorative here.
vi.mock("expo-symbols", async () => {
  const React = await import("react");
  return {
    SymbolView: function SymbolView() {
      return React.createElement("span", { "aria-hidden": true });
    },
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user: Me = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
  hideFromSearch: false,
};

function card(nick: string, name: string, extra: Partial<CircleCard> = {}): CircleCard {
  return {
    displayName: name,
    nick,
    relationship: "FRIENDS",
    subscribed: false,
    followsYou: false,
    ...extra,
  };
}

const fedor = card("fedor", "Фёдор");
const alena = card("alena", "Алёна", { relationship: "NONE", followsYou: true });
const oleg = card("oleg", "Олег", { relationship: "NONE", followsYou: true, subscribed: true });
const gleb = card("gleb", "Глеб", { relationship: "INCOMING_PENDING", followsYou: true });
const ivan = card("ivan", "Иван", { relationship: "OUTGOING_PENDING" });

/**
 * D-52: the friends search field exists for three friends and more, so a test
 * that types into it starts from at least three rows.
 */
function someFriends(count: number): CircleCard[] {
  return [fedor, alena, oleg, gleb, ivan]
    .slice(0, count)
    .map((one) => ({ ...one, relationship: "FRIENDS" }));
}

function page(items: CircleCard[], options: { nextCursor?: string | null; total?: number } = {}) {
  return {
    ok: true,
    page: {
      items,
      nextCursor: options.nextCursor ?? null,
      total: options.total ?? items.length,
    },
  };
}

function invitesAnswer(incoming: CircleCard[], outgoing: CircleCard[], incomingCount = incoming.length) {
  return {
    ok: true,
    invites: {
      incoming: { items: incoming, nextCursor: null, total: incoming.length },
      outgoing: { items: outgoing, nextCursor: null, total: outgoing.length },
      incomingCount,
    },
  };
}

let root: Root;
let container: HTMLElement;

function signedIn(account: Me = user) {
  api.apiRequest.mockImplementation(function request(path: string) {
    return Promise.resolve(
      path === "/api/v1/me" ? { ok: true, data: account } : { ok: true, data: { signedOut: true } },
    );
  });
}

function answers() {
  circle.fetchFriends.mockResolvedValue(page([fedor]));
  circle.fetchInvites.mockResolvedValue(invitesAnswer([], []));
  circle.fetchSubscriptions.mockResolvedValue(page([]));
  circle.fetchSubscribers.mockResolvedValue(page([]));
}

function testId(id: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

function text(): string {
  return document.body.textContent ?? "";
}

function control(label: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  expect(node, `элемент «${label}»`).not.toBeNull();
  return node as HTMLElement;
}

function controlByText(label: string): HTMLElement {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>('button, [role="button"], [role="link"]'),
  ).filter((node) => (node.textContent ?? "").trim() === label);
  expect(nodes.length, `элемент «${label}»`).toBeGreaterThan(0);
  return nodes[nodes.length - 1];
}

async function press(node: HTMLElement) {
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function settle(ms = 0) {
  await act(async () => {
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(ms);
    else if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <FriendsScreen />
      </AuthProvider>,
    );
  });
  await settle(0);
}

async function type(value: string) {
  const field = testId("friends-search-input") as HTMLInputElement | null;
  expect(field, "поле поиска среди друзей").not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      field,
      value,
    );
    field?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The tapped tab of the main segment: scoped to the tablist, not the whole page. */
async function openTab(label: string) {
  const tabs = testId("friends-tabs");
  expect(tabs, "сегмент «Друзья · Подписки · Запросы»").not.toBeNull();
  const tab = Array.from(tabs?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []).find(
    (node) => node.getAttribute("aria-label") === label,
  );
  expect(tab, `вкладка «${label}»`).not.toBeUndefined();
  await press(tab as HTMLElement);
  await settle(0);
}

async function openMenu(name: string) {
  await press(control(`Действия: ${name}`));
  await settle(350);
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  navigation.canGoBack.mockReturnValue(false);
  answers();
  invites.sendFriendInvite.mockResolvedValue({ ok: true, outcome: "INVITED" });
  invites.acceptFriendInvite.mockResolvedValue({ ok: true, outcome: "FRIENDS_CREATED" });
  invites.rejectFriendInvite.mockResolvedValue({ ok: true, outcome: "REJECTED" });
  subscription.subscribeToNick.mockResolvedValue({ ok: true, outcome: "SUBSCRIBED" });
  subscription.unsubscribeFromNick.mockResolvedValue({ ok: true, outcome: "UNSUBSCRIBED" });
  circle.cancelFriendInvite.mockResolvedValue({ ok: true, outcome: "CANCELLED" });
  circle.removeFriend.mockResolvedValue({ ok: true, outcome: "REMOVED" });
  circle.removeSubscriber.mockResolvedValue({ ok: true, outcome: "UNSUBSCRIBED" });
  block.blockUser.mockResolvedValue({ ok: true, outcome: "BLOCKED" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("друзья: гейт сессии", () => {
  it("пока сессия неизвестна, показывает общий экран загрузки и не читает круг", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(testId("session-loading")).not.toBeNull();
    expect(circle.fetchFriends).not.toHaveBeenCalled();
  });

  it("аноним уходит на вход с возвратом в друзья", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/friends" },
    });
    expect(circle.fetchFriends).not.toHaveBeenCalled();
  });

  it("ошибка проверки сессии — общий экран с «Повторить»", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    await mount();

    expect(testId("session-error")).not.toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe("друзья: шапка", () => {
  it("показывает название бренда, а не сырой ключ app.brandName", async () => {
    signedIn();
    await mount();

    expect(text()).toContain(PRODUCT_NAME);
    expect(text()).not.toContain("brandName");
  });

  /**
   * Story 6.2: «Друзья» is a tab root now. The root of a tab has no history of its
   * own, so the manual «Назад» is gone; the system back of Android opens «Вишлист».
   */
  it("у корня вкладки нет ручной ссылки «Назад»", async () => {
    signedIn();
    await mount();

    expect(container.querySelector('[aria-label="Назад"]')).toBeNull();
    const back = Array.from(
      container.querySelectorAll<HTMLElement>('button, [role="button"], [role="link"]'),
    ).filter((node) => (node.textContent ?? "").trim() === "Назад");
    expect(back).toHaveLength(0);
    // The screen itself stays: the segment still names the place.
    expect(testId("friends-tabs")?.textContent).toContain("Друзья");
  });

  /**
   * D-51: the visible «Друзья» heading and the «Найти знакомых» row above the
   * tabs are gone. The `h1` stays for the screen reader only, in a 1 px box, and
   * keeps the focus target of «Куда уходит фокус».
   */
  it("нет видимой шапки: h1 только для диктора, строки «Найти знакомых» нет", async () => {
    signedIn();
    await mount();

    const title = container.querySelector<HTMLElement>('[role="heading"][aria-level="1"]');
    expect(title?.textContent).toBe("Друзья");
    const frame = title?.parentElement as HTMLElement | null;
    expect(frame).not.toBeNull();
    expect(getComputedStyle(frame as HTMLElement).opacity).toBe("0");
    expect(getComputedStyle(frame as HTMLElement).overflow).toBe("hidden");

    // The way into «Найти знакомых» above the tabs is gone; only the empty list
    // carries it now (the next test).
    expect(testId("friends-find-contacts")).toBeNull();
    const aboveTabs = Array.from(
      container.querySelectorAll<HTMLElement>('button, [role="button"], [role="link"]'),
    ).filter((node) => (node.textContent ?? "").trim() === "Найти знакомых");
    expect(aboveTabs).toHaveLength(0);
  });
});

describe("друзья: вкладки и входящие", () => {
  it("рисует три вкладки и badge входящих, а в списке друзей не повторяет chip «Друзья»", async () => {
    circle.fetchInvites.mockResolvedValue(invitesAnswer([gleb], [], 2));
    signedIn();
    await mount();

    expect(testId("friends-tabs")?.textContent).toContain("Друзья");
    expect(testId("friends-tabs")?.textContent).toContain("Подписки");
    expect(control("Запросы, 2")).not.toBeNull();
    // v8 row: the decorative avatar adds the initials, then the name and the nick.
    const row = testId("friends-row-fedor")?.textContent ?? "";
    expect(row).toBe("ФФёдор@fedor");
    // No chip in the friends list: only «important» things carry one.
    expect(testId("friends-row-fedor")?.textContent).not.toContain("Друзья");
  });

  it("«Запросы» — входящие сверху, исходящие ниже", async () => {
    circle.fetchInvites.mockResolvedValue(invitesAnswer([gleb], [ivan]));
    signedIn();
    await mount();

    await openTab("Запросы, 1");

    const panel = testId("requests-panel");
    expect(panel?.textContent).toContain("Входящие");
    expect(panel?.textContent).toContain("Исходящие");
    expect(panel?.textContent).toContain("Глеб");
    expect(panel?.textContent).toContain("Иван");
    expect(panel?.textContent).toContain("Ожидает ответа");
  });
});

describe("друзья: поиск среди друзей", () => {
  it("ждёт паузу 300 мс, показывает «N из M» и ищет по всему кругу", async () => {
    vi.useFakeTimers();
    signedIn();
    circle.fetchFriends.mockResolvedValue(page(someFriends(3)));
    await mount();
    expect(circle.fetchFriends).toHaveBeenCalledWith("");
    expect(testId("friends-search-input")).not.toBeNull();

    await type("ал");
    await settle(299);
    expect(circle.fetchFriends).toHaveBeenCalledTimes(1);

    circle.fetchFriends.mockResolvedValue(page([alena], { total: 1 }));
    await settle(1);

    expect(circle.fetchFriends).toHaveBeenLastCalledWith("ал");
    expect(testId("friends-counter")?.textContent).toBe("1 из 1");
  });

  /** D-52: the field is about the whole circle, not the current answer. */
  it("при запросе с одним результатом поле не исчезает", async () => {
    vi.useFakeTimers();
    signedIn();
    circle.fetchFriends.mockResolvedValue(page(someFriends(3)));
    await mount();
    expect(testId("friends-search-input")).not.toBeNull();

    circle.fetchFriends.mockResolvedValue(page([fedor], { total: 1 }));
    await type("фё");
    await settle(300);

    expect(testId("friends-search-input")).not.toBeNull();
    expect(testId("friends-counter")?.textContent).toBe("1 из 1");
  });

  it.each([0, 1, 2])("при %i друзьях поля поиска нет", async (count) => {
    signedIn();
    circle.fetchFriends.mockResolvedValue(page(someFriends(count)));
    await mount();

    expect(testId("friends-search-input")).toBeNull();
    expect(testId("friends-counter")).toBeNull();
  });

  it("при трёх друзьях поле поиска видно", async () => {
    signedIn();
    circle.fetchFriends.mockResolvedValue(page(someFriends(3)));
    await mount();

    expect(testId("friends-search-input")).not.toBeNull();
    expect(testId("friends-counter")?.textContent).toBe("3 из 3");
  });

  it("0 результатов — «Никого не нашли по «{запрос}»» и переход в поиск с тем же q", async () => {
    vi.useFakeTimers();
    signedIn();
    circle.fetchFriends.mockResolvedValue(page(someFriends(3)));
    await mount();

    circle.fetchFriends.mockResolvedValue(page([]));
    await type("призрак");
    await settle(300);

    expect(text()).toContain("Никого не нашли по «призрак»");
    expect(text()).toContain("Проверьте имя или ник.");

    await press(controlByText("Искать среди всех пользователей"));

    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/search",
      params: { q: "призрак" },
    });
  });

  it("в пустом списке друзей «Найти знакомых» ведёт в /search", async () => {
    signedIn();
    circle.fetchFriends.mockResolvedValue(page([]));
    await mount();

    expect(text()).toContain("Пока нет друзей");
    expect(testId("friends-find-contacts")).toBeNull();
    await press(controlByText("Найти знакомых"));
    expect(navigation.push).toHaveBeenLastCalledWith("/search");
  });

  it("холодная загрузка — скелеты, ошибка — «Повторить» с тем же запросом", async () => {
    signedIn();
    circle.fetchFriends.mockResolvedValue({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(controlByText("Повторить")).not.toBeNull();

    circle.fetchFriends.mockResolvedValue(page([fedor]));
    await press(controlByText("Повторить"));
    await settle(0);

    expect(text()).toContain("Фёдор");
  });

  it("пока первая страница не пришла — скелеты PersonRow, а не вечный спиннер", async () => {
    signedIn();
    circle.fetchFriends.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(testId("friends-loading")).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="person-row-skeleton"]')).toHaveLength(3);
  });
});

describe("друзья: бесконечный список", () => {
  it("подгружает следующую страницу по курсору с запасом 200 px", async () => {
    signedIn();
    circle.fetchFriends.mockResolvedValue(page([fedor], { nextCursor: "cursor-1", total: 2 }));
    await mount();

    expect(testId("friends-row-fedor")).not.toBeNull();

    circle.fetchFriends.mockResolvedValue(page([alena], { total: 2 }));
    const pageNode = testId("friends-page") as HTMLElement;
    Object.defineProperty(pageNode, "scrollTop", { value: 400, configurable: true });
    Object.defineProperty(pageNode, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(pageNode, "offsetHeight", { value: 600, configurable: true });
    await act(async () => {
      pageNode.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await settle(0);

    expect(circle.fetchFriends).toHaveBeenLastCalledWith("", "cursor-1");
    expect(testId("friends-row-alena")).not.toBeNull();
    expect(testId("friends-all-shown")?.textContent).toBe("Показаны все (2)");
  });
});

describe("друзья: подписки", () => {
  it("переключатель «Я подписан (N) · Мои подписчики (N)» помнит выбор локально", async () => {
    signedIn();
    circle.fetchSubscriptions.mockResolvedValue(page([alena]));
    circle.fetchSubscribers.mockResolvedValue(page([oleg]));
    await mount();

    await openTab("Подписки");
    await settle(0);

    expect(text()).toContain("Я подписан (1)");
    expect(text()).toContain("Мои подписчики (1)");

    await press(control("Мои подписчики (1)"));
    await settle(0);

    expect(window.localStorage.getItem(subscriptionViewKey("anya"))).toBe("subscribers");
    expect(testId("friends-row-oleg")?.textContent).toContain("Взаимная подписка");
  });

  it("сохранённый выбор поднимается при следующем открытии", async () => {
    window.localStorage.setItem(subscriptionViewKey("anya"), "subscribers");
    signedIn();
    circle.fetchSubscribers.mockResolvedValue(page([alena]));
    await mount();
    await settle(0);

    await openTab("Подписки");
    await settle(0);

    expect(control("Мои подписчики (1)").getAttribute("aria-selected")).toBe("true");
    expect(testId("friends-row-alena")?.textContent).toContain("Подписан на вас");
  });

  it("«Отписаться» — без confirm, строка исчезает, toast «Вы отписались»", async () => {
    signedIn();
    circle.fetchSubscriptions.mockResolvedValue(page([alena]));
    await mount();
    await openTab("Подписки");

    await openMenu("Алёна");
    await press(controlByText("Отписаться"));
    await settle(0);

    expect(subscription.unsubscribeFromNick).toHaveBeenCalledWith("alena");
    expect(testId("friends-row-alena")).toBeNull();
    expect(text()).toContain("Вы отписались");
  });

  it("«Убрать подписчика» спрашивает confirm и только потом удаляет", async () => {
    signedIn();
    circle.fetchSubscriptions.mockResolvedValue(page([]));
    circle.fetchSubscribers.mockResolvedValue(page([alena]));
    await mount();
    await openTab("Подписки");
    await press(control("Мои подписчики (1)"));
    await settle(0);

    await openMenu("Алёна");
    await press(controlByText("Убрать подписчика"));
    await settle(300);

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      "Алёна перестанет видеть ваши желания «всем» в подписках.",
    );
    expect(circle.removeSubscriber).not.toHaveBeenCalled();

    await press(controlByText("Убрать"));
    await settle(0);

    expect(circle.removeSubscriber).toHaveBeenCalledWith("anya", "alena");
    expect(testId("friends-row-alena")).toBeNull();
    expect(text()).toContain("Алёна больше не подписан");
  });
});

describe("друзья: запросы", () => {
  it("«Принять» принимает приглашение и показывает toast", async () => {
    circle.fetchInvites.mockResolvedValue(invitesAnswer([gleb], []));
    signedIn();
    await mount();
    await openTab("Запросы, 1");

    // v8: the answer is an icon button — a 32 px filled circle inside the 44 px target.
    const accept = control("Принять: Глеб");
    const visual = accept.querySelector<HTMLElement>("[data-testid='button-icon']");
    expect(visual).not.toBeNull();
    expect(getComputedStyle(visual as HTMLElement).width).toBe("32px");
    expect(getComputedStyle(visual as HTMLElement).backgroundColor).toBe("#2B3A7A");
    // The decline is the quiet circle next to it, still with its own name.
    expect(control("Отклонить: Глеб").getAttribute("aria-label")).toBe("Отклонить: Глеб");

    await press(control("Принять: Глеб"));
    await settle(0);

    expect(invites.acceptFriendInvite).toHaveBeenCalledWith("gleb");
    expect(testId("friends-row-gleb")).toBeNull();
    expect(text()).toContain("Глеб теперь в друзьях");
  });

  it("«Отклонить» убирает входящее и не показывает «Отклонено» на этом экране", async () => {
    circle.fetchInvites.mockResolvedValue(invitesAnswer([gleb], []));
    signedIn();
    await mount();
    await openTab("Запросы, 1");

    await press(control("Отклонить: Глеб"));
    await settle(0);

    expect(invites.rejectFriendInvite).toHaveBeenCalledWith("gleb");
    expect(testId("friends-row-gleb")).toBeNull();
    expect(text()).not.toContain("Отклонено");
  });

  it("«Отменить» убирает исходящее и показывает «Приглашение отменено»", async () => {
    circle.fetchInvites.mockResolvedValue(invitesAnswer([], [ivan]));
    signedIn();
    await mount();

    await openTab("Запросы");
    await press(control("Отменить: Иван"));
    await settle(0);

    expect(circle.cancelFriendInvite).toHaveBeenCalledWith("ivan");
    expect(testId("friends-row-ivan")).toBeNull();
    expect(text()).toContain("Приглашение отменено");
    expect(text()).not.toContain("Отклонено");
  });

  it("пустая вкладка — EmptyState «Запросов нет»", async () => {
    signedIn();
    await mount();
    await openTab("Запросы");

    expect(text()).toContain("Запросов нет");
    expect(text()).toContain("Здесь появятся приглашения в друзья.");
  });

  /**
   * Story 6.2 (BADGE_REFRESH): the shell's «Друзья» badge reads the same
   * `incomingCount`. «Принять» on this screen asks the provider for a fresh count,
   * so the badge stops showing a request that is already answered.
   */
  it("после «Принять» счётчик badge перечитывается (провайдер оболочки)", async () => {
    circle.fetchInvites.mockResolvedValue(invitesAnswer([gleb], [], 1));
    signedIn();
    await act(async () => {
      root.render(
        <AuthProvider>
          <InviteBadgeProvider>
            <FriendsScreen />
          </InviteBadgeProvider>
        </AuthProvider>,
      );
    });
    await settle(0);

    // The mount read of the screen and the one of the badge provider.
    const before = circle.fetchInvites.mock.calls.length;
    await openTab("Запросы, 1");
    await press(control("Принять: Глеб"));
    await settle(0);

    expect(circle.fetchInvites.mock.calls.length).toBeGreaterThan(before);
  });
});

describe("друзья: меню ⋮", () => {
  it("в списке друзей destructive «Удалить из друзей», затем «Заблокировать»", async () => {
    signedIn();
    await mount();

    await openMenu("Фёдор");

    const menu = document.body.textContent ?? "";
    expect(menu).toContain("Открыть профиль");
    expect(menu).toContain("Удалить из друзей");
    expect(menu).toContain("Заблокировать");
    expect(menu.indexOf("Открыть профиль")).toBeLessThan(menu.indexOf("Удалить из друзей"));
    expect(menu.indexOf("Удалить из друзей")).toBeLessThan(menu.indexOf("Заблокировать"));
  });

  it("в подписчиках есть «Убрать подписчика» и «Заблокировать», но нет «Удалить из друзей»", async () => {
    signedIn();
    circle.fetchSubscribers.mockResolvedValue(page([alena]));
    await mount();
    await openTab("Подписки");
    await press(control("Мои подписчики (1)"));
    await settle(0);

    await openMenu("Алёна");

    expect(document.body.textContent).toContain("Убрать подписчика");
    expect(document.body.textContent).toContain("Заблокировать");
    expect(document.body.textContent).not.toContain("Удалить из друзей");
  });

  it("«Добавить в друзья» отправляет приглашение и оставляет строку", async () => {
    signedIn();
    circle.fetchSubscriptions.mockResolvedValue(page([alena]));
    await mount();
    await openTab("Подписки");

    await openMenu("Алёна");
    await press(controlByText("Добавить в друзья"));
    await settle(0);

    expect(invites.sendFriendInvite).toHaveBeenCalledWith("alena");
    expect(text()).toContain("Приглашение отправлено");
    expect(testId("friends-row-alena")).not.toBeNull();
  });

  it("ошибка сети откатывает отписку и оставляет toast «Нет сети»", async () => {
    signedIn();
    circle.fetchSubscriptions.mockResolvedValue(page([alena]));
    subscription.unsubscribeFromNick.mockResolvedValue({ ok: false, network: true });
    await mount();
    await openTab("Подписки");

    await openMenu("Алёна");
    await press(controlByText("Отписаться"));
    await settle(0);

    expect(testId("friends-row-alena")).not.toBeNull();
    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
  });
});

describe("друзья: удаление из друзей (Story 4.4)", () => {
  /**
   * The item of the row whose menu was opened. Tamagui keeps a closed sheet in
   * the happy-dom tree, so with several rows the same label exists more than
   * once; the list order makes the first match the opened row.
   */
  function openedMenuItem(label: string): HTMLElement {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], [role="link"]'),
    ).filter((node) => (node.textContent ?? "").trim() === label);
    expect(nodes.length, `пункт «${label}»`).toBeGreaterThan(0);
    return nodes[0];
  }

  /** The ⋮ menu of the friends tab, then the destructive item and its confirm. */
  async function askRemoveFriend(name: string) {
    await openMenu(name);
    await press(openedMenuItem("Удалить из друзей"));
    await settle(300);
  }

  it("confirm называет имя и последствия, «Отмена» не шлёт запрос и оставляет строку", async () => {
    signedIn();
    await mount();

    await askRemoveFriend("Фёдор");

    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain("Удалить Фёдор из друзей?");
    expect(dialog?.textContent).toContain(
      "Желания «друзьям» перестанут быть видны друг другу. Брони останутся.",
    );
    expect(circle.removeFriend).not.toHaveBeenCalled();

    await press(controlByText("Отмена"));
    await settle(0);

    expect(circle.removeFriend).not.toHaveBeenCalled();
    expect(testId("friends-row-fedor")).not.toBeNull();
  });

  it("confirm удаляет друга, убирает строку, обновляет total и говорит toast", async () => {
    signedIn();
    // D-52: four friends, so the search field and its counter stay after the removal.
    circle.fetchFriends.mockResolvedValue(page(someFriends(4)));
    await mount();
    expect(testId("friends-counter")?.textContent).toBe("4 из 4");

    await askRemoveFriend("Фёдор");
    await press(controlByText("Удалить"));
    await settle(0);

    expect(circle.removeFriend).toHaveBeenCalledWith("fedor");
    expect(testId("friends-row-fedor")).toBeNull();
    expect(testId("friends-row-alena")).not.toBeNull();
    expect(testId("friends-counter")?.textContent).toBe("3 из 3");
    expect(testId("friends-all-shown")?.textContent).toBe("Показаны все (3)");
    expect(text()).toContain("Фёдор удалён из друзей");
  });

  it.each(["REMOVED", "ALREADY_REMOVED"])(
    "исход %s — успех: toast без ошибки",
    async (outcome) => {
      circle.removeFriend.mockResolvedValue({ ok: true, outcome });
      signedIn();
      await mount();

      await askRemoveFriend("Фёдор");
      await press(controlByText("Удалить"));
      await settle(0);

      expect(testId("friends-row-fedor")).toBeNull();
      expect(text()).toContain("Фёдор удалён из друзей");
      expect(text()).not.toContain("Не получилось");
      expect(text()).not.toContain("Нет доступа");
    },
  );

  it("ошибка сети возвращает строку и оставляет toast «Нет сети»", async () => {
    circle.removeFriend.mockResolvedValue({ ok: false, network: true });
    signedIn();
    await mount();

    await askRemoveFriend("Фёдор");
    await press(controlByText("Удалить"));
    await settle(0);

    expect(testId("friends-row-fedor")).not.toBeNull();
    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(text()).not.toContain("удалён из друзей");
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("пока запрос идёт, повторное подтверждение не шлёт второй запрос", async () => {
    let resolveRemove: (value: unknown) => void = () => {};
    const removal = new Promise((resolve) => {
      resolveRemove = resolve;
    });
    circle.removeFriend.mockReturnValue(removal);
    signedIn();
    await mount();

    await askRemoveFriend("Фёдор");
    await press(controlByText("Удалить"));
    await settle(0);

    await press(controlByText("Удалить"));
    await settle(0);

    expect(circle.removeFriend).toHaveBeenCalledTimes(1);

    await act(async () => resolveRemove({ ok: true, outcome: "REMOVED" }));
    await settle(0);
  });

  it("подписки человека не меняются: строка остаётся во вкладках подписок", async () => {
    signedIn();
    circle.fetchSubscriptions.mockResolvedValue(page([fedor]));
    await mount();

    await askRemoveFriend("Фёдор");
    await press(controlByText("Удалить"));
    await settle(0);

    await openTab("Подписки");
    await settle(0);

    expect(testId("friends-row-fedor")).not.toBeNull();
    expect(subscription.unsubscribeFromNick).not.toHaveBeenCalled();
  });
});

describe("друзья: блокировка (Story 4.5)", () => {
  /** The first row of that label: Tamagui keeps closed sheets in the tree. */
  function menuItem(label: string): HTMLElement {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], [role="link"]'),
    ).filter((node) => (node.textContent ?? "").trim() === label);
    expect(nodes.length, `пункт «${label}»`).toBeGreaterThan(0);
    return nodes[0];
  }

  function confirmButton(label: string): HTMLElement {
    const dialog = document.querySelector('[role="alertdialog"]');
    const target = Array.from(
      dialog?.querySelectorAll<HTMLElement>('button, [role="button"]') ?? [],
    ).find((node) => (node.textContent ?? "").trim() === label);
    expect(target, `кнопка «${label}» в confirm`).not.toBeUndefined();
    return target as HTMLElement;
  }

  /** The friends row's ⋮, then its last item and the confirm it opens. */
  async function askBlock(name: string) {
    await openMenu(name);
    await press(menuItem("Заблокировать"));
    await settle(300);
  }

  it("confirm называет имя и последствия; «Отмена» не блокирует и оставляет строку", async () => {
    signedIn();
    await mount();

    await askBlock("Фёдор");

    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain("Заблокировать Фёдор?");
    expect(dialog?.textContent).toContain(
      "Вы перестанете видеть друг друга, дружба и подписки удалятся.",
    );
    expect(dialog?.textContent).not.toContain("бронь");
    expect(dialog?.textContent).toContain("Заблокировать");
    expect(dialog?.textContent).toContain("Отмена");
    expect(block.blockUser).not.toHaveBeenCalled();

    await press(confirmButton("Отмена"));
    await settle(0);

    expect(block.blockUser).not.toHaveBeenCalled();
    expect(testId("friends-row-fedor")).not.toBeNull();
  });

  it("блок убирает строку, обновляет total и говорит toast", async () => {
    signedIn();
    // D-52: four friends, so the search field and its counter stay after the block.
    circle.fetchFriends.mockResolvedValue(page(someFriends(4)));
    await mount();
    expect(testId("friends-counter")?.textContent).toBe("4 из 4");

    await askBlock("Фёдор");
    await press(confirmButton("Заблокировать"));
    await settle(0);

    expect(block.blockUser).toHaveBeenCalledWith("fedor");
    expect(testId("friends-row-fedor")).toBeNull();
    expect(testId("friends-row-alena")).not.toBeNull();
    expect(testId("friends-counter")?.textContent).toBe("3 из 3");
    expect(text()).toContain("Фёдор заблокирован");
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it.each(["BLOCKED", "ALREADY_BLOCKED"])("исход %s — успех: toast без ошибки", async (outcome) => {
    block.blockUser.mockResolvedValue({ ok: true, outcome });
    signedIn();
    await mount();

    await askBlock("Фёдор");
    await press(confirmButton("Заблокировать"));
    await settle(0);

    expect(testId("friends-row-fedor")).toBeNull();
    expect(text()).toContain("Фёдор заблокирован");
    expect(text()).not.toContain("Нет доступа");
  });

  it("ошибка сети возвращает строку и оставляет toast «Нет сети»", async () => {
    block.blockUser.mockResolvedValue({ ok: false, network: true });
    signedIn();
    await mount();

    await askBlock("Фёдор");
    await press(confirmButton("Заблокировать"));
    await settle(0);

    expect(testId("friends-row-fedor")).not.toBeNull();
    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(text()).not.toContain("заблокирован");
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("в «Я подписан» тот же confirm убирает строку подписки", async () => {
    signedIn();
    circle.fetchSubscriptions.mockResolvedValue(page([alena]));
    await mount();
    await openTab("Подписки");

    await askBlock("Алёна");
    await press(confirmButton("Заблокировать"));
    await settle(0);

    expect(block.blockUser).toHaveBeenCalledWith("alena");
    expect(testId("friends-row-alena")).toBeNull();
    expect(text()).toContain("Алёна заблокирован");
  });

  it("в запросах «Заблокировать» стоит рядом с принять/отклонить и убирает строку", async () => {
    circle.fetchInvites.mockResolvedValue(invitesAnswer([gleb], []));
    signedIn();
    await mount();
    await openTab("Запросы, 1");

    await press(control("Заблокировать: Глеб"));
    await settle(300);

    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain("Заблокировать Глеб?");
    await press(confirmButton("Заблокировать"));
    await settle(0);

    expect(block.blockUser).toHaveBeenCalledWith("gleb");
    expect(testId("friends-row-gleb")).toBeNull();
    expect(text()).toContain("Глеб заблокирован");
    expect(invites.acceptFriendInvite).not.toHaveBeenCalled();
  });
});
