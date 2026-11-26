// @vitest-environment happy-dom
import { breakpoints, spacing } from "@gift-list/ui";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, useLayoutEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openSessionEvents } from "@/platform/session-events";
import { AuthProvider, useAuth } from "@/session/auth-context";
import { controls, dialogElement, settle } from "@/test/dom";
import { observeContentWidth, type SimulatedContent } from "@/test/layout";
import { declarationsFor, findByPaint, paintedSpace, paintedValue } from "@/test/tamagui-css";
import { cardGrid, cardGridForContent, pageGutter } from "@/ui/card-grid";
import PublicWishlistScreen from "../../app/(link)/wishlist/[token]";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  setParams: vi.fn(),
}));
const search = vi.hoisted(() => ({
  params: {} as Record<string, string | undefined>,
}));
/** A JS width a test hands the screen instead of the one `clientWidth` reports. */
const dimensions = vi.hoisted(() => ({ width: null as number | null }));

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => store);
vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  // Only a test that sets `dimensions.width` changes what the hook returns; every
  // other test sees react-native-web's own value.
  function useWindowDimensions() {
    const size = actual.useWindowDimensions();
    return dimensions.width === null ? size : { ...size, width: dimensions.width };
  }
  return { ...actual, useWindowDimensions };
});
vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "ru-RU" }],
}));
vi.mock("expo-router", async () => {
  const React = await import("react");
  /** The target as a string: `asChild` hands it to the anchor the child draws. */
  function hrefOf(href: unknown): string | undefined {
    return typeof href === "string"
      ? href
      : (href as { pathname?: string } | null | undefined)?.pathname;
  }
  return {
    router: navigation,
    Stack: { Screen: () => null },
    // An honest `asChild`: the router's `Link` puts `href` and `onPress` onto its
    // only child and draws nothing of its own — the card itself is the anchor.
    Link: function Link({
      href,
      asChild,
      children,
    }: {
      href?: unknown;
      asChild?: boolean;
      children?: React.ReactElement<Record<string, unknown>>;
    }) {
      if (!asChild) return React.createElement("a", { href: hrefOf(href) }, children);
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        href: hrefOf(href),
        onPress: function onPress() {
          navigation.push(href);
        },
      });
    },
    useLocalSearchParams: () => search.params,
  };
});
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

const owner = { displayName: "Аня", nick: "anya" };

function gift(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    title: "Наушники",
    description: null,
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

function giftsAnswer(cards: unknown[], ownerBlock: unknown = owner) {
  return {
    ok: true,
    data: {
      access: "gifts",
      gifts: cards,
      ...(ownerBlock === undefined ? {} : { owner: ownerBlock }),
    },
  };
}

function notFoundAnswer() {
  return { ok: false, code: "NOT_FOUND", message: "Not found" };
}

/** `/api/v1/me` answers with the session; every other path answers with the link. */
function respond(link: unknown, session: unknown = { ok: true, data: user }) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(path === "/api/v1/me" ? session : link),
  );
}

function linkReads(): number {
  return api.apiRequest.mock.calls.filter(([path]) =>
    String(path).startsWith("/api/v1/l/"),
  ).length;
}

let root: Root;
let container: HTMLElement;
/** W12.23: the content width a browser would report for the column. */
let measuredLayout: SimulatedContent;

function text(): string {
  return document.body.textContent ?? "";
}

function loadingRegion(): Element | null {
  return container.querySelector('[data-testid="wishlist-loading"]');
}

function button(label: string): HTMLElement | undefined {
  return controls(document).find((node) => (node.textContent ?? "").includes(label));
}

async function press(label: string) {
  const target = button(label);
  expect(target).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

async function mount(children?: ReactNode) {
  await act(async () => {
    root.render(
      <AuthProvider>
        <PublicWishlistScreen />
        {children}
      </AuthProvider>,
    );
  });
  await settle(10);
}

/**
 * The width `useWindowDimensions` reads on web: happy-dom has no layout, so
 * `documentElement.clientWidth` stays 0 unless a test sets it. `resize` makes the
 * mounted screen re-render with the new value, as a browser window resize would.
 */
async function setViewportWidth(width: number) {
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: width,
  });
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  dimensions.width = null;
  measuredLayout = observeContentWidth();
  search.params = { token: "tok_1" };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  measuredLayout.restore();
});

describe("вишлист по ссылке: вход", () => {
  it("гость (UNAUTHENTICATED) видит публичный список без входа", async () => {
    respond(giftsAnswer([gift()]), { ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(linkReads()).toBe(1);
    expect(text()).toContain("Аня");
    expect(text()).toContain("Наушники");
    // The stale token is still cleared, but the visitor stays on the public page.
    expect(store.clearSessionToken).toHaveBeenCalled();
  });

  const unauthenticated = { ok: false, code: "UNAUTHENTICATED", message: "" };

  it.each([
    {
      outcome: "показывает список",
      guestAnswer: giftsAnswer([gift()]),
      expectedText: "Наушники",
      retryVisible: false,
    },
    {
      outcome: "показывает общую ошибку с «Повторить» при повторном 401",
      guestAnswer: unauthenticated,
      expectedText: "Не получилось загрузить. Попробуйте ещё раз.",
      retryVisible: true,
    },
  ])(
    "после 401 вошедшего выходит один раз и $outcome",
    async function rereadsAsGuest({ guestAnswer, expectedText, retryVisible }) {
      api.apiRequest
        .mockResolvedValueOnce({ ok: true, data: user })
        .mockResolvedValueOnce(unauthenticated)
        .mockResolvedValueOnce({ ok: true, data: { signedOut: true } })
        .mockResolvedValue(guestAnswer);
      await mount();

      expect(api.apiRequest.mock.calls).toEqual([
        ["/api/v1/me"],
        ["/api/v1/l/tok_1"],
        ["/api/v1/session", { method: "DELETE" }],
        ["/api/v1/l/tok_1"],
      ]);
      expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(text()).toContain(expectedText);
      expect(Boolean(button("Повторить"))).toBe(retryVisible);
      expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
      expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
    },
  );

  it("сетевая ошибка сессии не уводит на вход: список читается как для гостя", async () => {
    respond(giftsAnswer([gift()]), { ok: false, network: true });
    await mount();

    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(linkReads()).toBe(1);
    expect(text()).toContain("Наушники");
  });

  it("сетевая ошибка сессии и недоступный API дают «Повторить», а не редирект", async () => {
    respond({ ok: false, network: true }, { ok: false, network: true });
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(button("Повторить")).toBeDefined();

    // «Повторить» rereads both the session and the list.
    respond(giftsAnswer([gift()]), { ok: true, data: user });
    await press("Повторить");

    expect(api.apiRequest.mock.calls.filter(([path]) => path === "/api/v1/me").length).toBe(2);
    expect(text()).toContain("Наушники");
  });

  it.each(["a/b", "a?b", "a#b", "..", "%2f"])(
    "небезопасный сегмент %s не уводит на вход, не запрашивает API и даёт 404",
    async (token) => {
      search.params = { token };
      respond(giftsAnswer([gift()]));
      await mount();

      expect(navigation.replace).not.toHaveBeenCalled();
      expect(linkReads()).toBe(0);
      expect(text()).toContain("Страница не найдена");
      expect(text()).toContain("На главную");
      expect(document.querySelector('[data-testid="not-found-page"]')).not.toBeNull();
    },
  );

  it("пока сессия неизвестна, список не запрашивается и экран не пустой", async () => {
    api.apiRequest.mockImplementation((path: string) =>
      path === "/api/v1/me" ? new Promise(() => {}) : Promise.resolve(giftsAnswer([])),
    );
    await mount();

    expect(linkReads()).toBe(0);
    expect(navigation.replace).not.toHaveBeenCalled();
    const region = loadingRegion();
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем вишлист");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(3);
  });
});

describe("вишлист по той же ссылке при смене зрителя", () => {
  type Auth = ReturnType<typeof useAuth>;

  const friend = { ...user, id: "u-friend", nick: "oleg", hideFromSearch: false };
  const anotherUser = { ...user, id: "u-other", nick: "masha", hideFromSearch: false };
  const friendWish = gift({ id: "g-friend", title: "Подарок для друзей", visibility: "FRIENDS" });
  const publicWish = gift({ id: "g-public", title: "Подарок для всех" });

  function AuthProbe({ onCommit }: { onCommit: (auth: Auth) => void }) {
    const auth = useAuth();
    useLayoutEffect(function observeAuthCommit() {
      onCommit(auth);
    }, [auth, onCommit]);
    return null;
  }
  AuthProbe.displayName = "AuthProbe";

  async function mountWithAuth() {
    let commit: { auth: Auth; pageText: string } | undefined;

    function rememberCommit(auth: Auth) {
      commit = { auth, pageText: text() };
    }

    await mount(<AuthProbe onCommit={rememberCommit} />);

    return function readCommit() {
      if (!commit) throw new Error("AuthProbe не получил состояние сессии");
      return commit;
    };
  }

  function respondToViewerReads(...answers: Promise<unknown>[]) {
    api.apiRequest.mockImplementation(function answer(path: string) {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: friend });
      if (path === "/api/v1/session") {
        return Promise.resolve({ ok: true, data: { signedOut: true } });
      }
      if (path === "/api/v1/l/tok_1") {
        const answer = answers.shift();
        if (answer) return answer;
      }
      throw new Error(`Неожиданный запрос ${path}`);
    });
  }

  it("вкладка без BroadcastChannel перечитывает список по storage-сигналу другой вкладки", async function reloadFromStorageEvent() {
    vi.stubGlobal("BroadcastChannel", undefined);
    const storage = window.localStorage;
    const write = vi.spyOn(storage, "setItem");
    const remove = vi.spyOn(storage, "removeItem");
    const onOtherChange = vi.fn();
    const otherTab = openSessionEvents(onOtherChange);
    try {
      const next = Promise.withResolvers<unknown>();
      api.apiRequest
        .mockResolvedValueOnce({ ok: true, data: friend })
        .mockResolvedValueOnce(giftsAnswer([publicWish, friendWish]))
        .mockReturnValueOnce(next.promise)
        .mockResolvedValueOnce(giftsAnswer([publicWish]));
      await mount();
      expect(text()).toContain(friendWish.title);

      otherTab?.publish();
      expect(write).toHaveBeenCalledExactlyOnceWith("gift-list.session-change", "");
      expect(remove).toHaveBeenCalledExactlyOnceWith("gift-list.session-change");
      const [key, marker] = write.mock.calls[0];
      expect(storage.getItem(key)).toBeNull();
      otherTab?.close();

      // happy-dom does not deliver localStorage writes across windows.
      await act(async function deliverStorageEvents() {
        window.dispatchEvent(new StorageEvent("storage", { key, oldValue: marker, storageArea: storage }));
        expect(linkReads()).toBe(1);
        window.dispatchEvent(new StorageEvent("storage", { key, newValue: marker, storageArea: storage }));
      });
      expect(onOtherChange).not.toHaveBeenCalled();
      expect(text()).not.toContain(friendWish.title);
      expect(loadingRegion()).not.toBeNull();
      expect(linkReads()).toBe(1);

      await act(async function receiveGuestSession() {
        next.resolve({ ok: false, code: "UNAUTHENTICATED", message: "" });
      });
      expect(text()).toContain(publicWish.title);
      expect(text()).not.toContain(friendWish.title);
      expect(linkReads()).toBe(2);
      expect(write).toHaveBeenCalledTimes(1);
    } finally {
      otherTab?.close();
      write.mockRestore();
      remove.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it.each([
    {
      transition: "смене аккаунта",
      expectedState: { status: "ready", user: anotherUser },
      changeViewer: function switchAccount(auth: Auth) {
        auth.setUser(anotherUser);
      },
    },
    {
      transition: "выходе",
      expectedState: { status: "anonymous" },
      changeViewer: function signOut(auth: Auth) {
        return auth.signOut();
      },
    },
  ])(
    "при $transition скрывает старые карточки до ответа для нового зрителя",
    async function hidesPreviousCards({ expectedState, changeViewer }) {
      const next = Promise.withResolvers<ReturnType<typeof giftsAnswer>>();
      respondToViewerReads(Promise.resolve(giftsAnswer([friendWish])), next.promise);
      const readCommit = await mountWithAuth();

      expect(readCommit().auth.state).toMatchObject({ status: "ready", user: friend });
      expect(text()).toContain(friendWish.title);
      expect(linkReads()).toBe(1);

      await act(async function changeSession() {
        await changeViewer(readCommit().auth);
      });

      const { auth, pageText } = readCommit();
      expect(auth.state).toMatchObject(expectedState);
      // The first commit for the new viewer runs before passive effects can hide the old list.
      expect(pageText).not.toContain(friendWish.title);
      expect(text()).not.toContain(friendWish.title);
      expect(loadingRegion()).not.toBeNull();
      expect(linkReads()).toBe(2);

      await act(async function receiveNewList() {
        next.resolve(giftsAnswer([publicWish]));
      });

      expect(text()).toContain(publicWish.title);
      expect(text()).not.toContain(friendWish.title);
      expect(linkReads()).toBe(2);
    },
  );

  it("запоздалый ответ для прежнего аккаунта не заменяет актуальный список", async function ignoresLateAnswer() {
    const previous = Promise.withResolvers<ReturnType<typeof giftsAnswer>>();
    respondToViewerReads(previous.promise, Promise.resolve(giftsAnswer([publicWish])));
    const readCommit = await mountWithAuth();

    expect(linkReads()).toBe(1);
    expect(loadingRegion()).not.toBeNull();

    await act(async function changeAccount() {
      readCommit().auth.setUser(anotherUser);
    });

    expect(text()).toContain(publicWish.title);
    expect(linkReads()).toBe(2);

    await act(async function receiveOldList() {
      previous.resolve(giftsAnswer([friendWish]));
    });

    expect(text()).toContain(publicWish.title);
    expect(text()).not.toContain(friendWish.title);
    expect(linkReads()).toBe(2);
  });

  it.each([
    {
      giftAccess: "доступно",
      newList: [gift({ id: friendWish.id, title: "Новое название подарка" })],
      expectedParams: { openReserve: "1", title: "Новое название подарка" },
    },
    {
      giftAccess: "недоступно",
      newList: [publicWish],
      expectedParams: { title: "" },
    },
  ])(
    "тот же reserve ждёт новую выдачу, даже если желание $giftAccess",
    async function rechecksReserve({ newList, expectedParams }) {
      search.params = { token: "tok_1", reserve: friendWish.id };
      const next = Promise.withResolvers<ReturnType<typeof giftsAnswer>>();
      respondToViewerReads(Promise.resolve(giftsAnswer([friendWish])), next.promise);
      const readCommit = await mountWithAuth();
      const target = { id: friendWish.id, listToken: "tok_1" };
      expect(navigation.replace).toHaveBeenCalledExactlyOnceWith({
        pathname: "/gifts/[id]",
        params: { ...target, openReserve: "1", title: friendWish.title },
      });
      navigation.replace.mockClear();

      await act(async function changeAccount() {
        readCommit().auth.setUser(anotherUser);
      });
      expect(navigation.replace).not.toHaveBeenCalled();
      expect(loadingRegion()).not.toBeNull();

      await act(async function receiveNewList() {
        next.resolve(giftsAnswer(newList));
      });
      expect(navigation.replace).toHaveBeenCalledExactlyOnceWith({
        pathname: "/gifts/[id]",
        params: { ...target, ...expectedParams },
      });
      expect(linkReads()).toBe(2);
    },
  );
});

describe("вишлист по ссылке: список", () => {
  it("после смены токена запоздалый ответ по старой ссылке не заменяет новый список", async function ignoresOldLinkAnswer() {
    const previous = Promise.withResolvers<ReturnType<typeof giftsAnswer>>();
    api.apiRequest
      .mockResolvedValueOnce({ ok: true, data: user })
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce(giftsAnswer([gift({ id: "g2", title: "Свитер" })]));
    await mount();
    expect(loadingRegion()).not.toBeNull();

    search.params = { token: "tok_2" };
    await mount();
    expect(text()).toContain("Свитер");

    await act(async function receiveOldLink() {
      previous.resolve(giftsAnswer([gift()]));
    });

    expect(text()).toContain("Свитер");
    expect(text()).not.toContain("Наушники");
    expect(api.apiRequest.mock.calls).toEqual([
      ["/api/v1/me"],
      ["/api/v1/l/tok_1"],
      ["/api/v1/l/tok_2"],
    ]);
  });

  it("рисует имя владельца, ник и все карточки, которые вернул сервер", async () => {
    respond(
      giftsAnswer([
        gift(),
        gift({
          id: "g2",
          title: "Свитер",
          visibility: "FRIENDS",
          priceAmount: 1050,
          priceCurrency: "BYN",
        }),
      ]),
    );
    await mount();

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/l/tok_1");
    expect(container.querySelector('[data-testid="page-footer"]')).not.toBeNull();
    // L8: the owner is the only level-1 heading on the page.
    expect(container.querySelectorAll('[role="heading"][aria-level="1"]')).toHaveLength(1);
    expect(text()).toContain("Аня");
    expect(text()).toContain("@anya");
    expect(text()).toContain("Наушники");
    expect(text()).toContain("Свитер");
    // The link page has no visibility chip and no hidden count.
    expect(text()).not.toContain("Всем");
    expect(text()).not.toContain("Друзьям");
  });

  it("карточка — ссылка на страницу желания, «Куплю сам» ведёт в бронь", async () => {
    const card = gift();
    respond(giftsAnswer([card]));
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (String(path).startsWith("/api/v1/gifts/")) {
        return Promise.resolve({
          ok: true,
          data: { ...card, description: "Обновлённое описание с сервера." },
        });
      }
      return Promise.resolve(giftsAnswer([card]));
    });
    await mount();

    // CLE-129, T4.4: the card is a real link to the wish page; no dialog, and the
    // guest keeps the list token, so the page reads the same public list.
    const cardLink = container.querySelector(
      '[role="listitem"] [role="link"]',
    ) as HTMLElement;
    expect(cardLink.getAttribute("aria-label")).toBe("Наушники");
    await act(async () => {
      cardLink.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();

    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/gifts/[id]",
      params: { id: "g1", listToken: "tok_1", title: "Наушники" },
    });
    expect(dialogElement()).toBeNull();

    // This file's translator stub only loads `app` and `common`, so the web
    // catalogue key is what the button renders here.
    await press("buyMyself");
    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/gifts/[id]",
      params: { id: "g1", listToken: "tok_1", title: "Наушники", openReserve: "1" },
    });
    expect(dialogElement()).toBeNull();
  });

  it("имя дарителя — ссылка на профиль, вне кнопки карточки", async () => {
    respond(
      giftsAnswer([
        gift(),
        gift({
          id: "g2",
          title: "Свитер",
          status: "RESERVED",
          reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
        }),
      ]),
    );
    await mount();

    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[role="list"] [role="listitem"]'),
    );
    const reserved = items.find(function withSweater(node) {
      return (node.textContent ?? "").includes("Свитер");
    });
    expect(reserved, "карточка забронированного желания").toBeDefined();

    // The card draws «Берёт Олег»: the name is the link, its target is the profile.
    expect(reserved?.textContent).toContain("Берёт");
    const link = reserved?.querySelector<HTMLElement>('[role="link"][href="/u/oleg"]');
    expect(link?.textContent).toBe("Олег");

    // The line is a sibling of the card link: the profile link is not nested in it.
    const cardLink = Array.from(
      reserved?.querySelectorAll<HTMLElement>('[role="link"]') ?? [],
    ).find(function isCard(node) {
      return node.getAttribute("href") !== "/u/oleg";
    });
    expect(cardLink?.contains(link as Node)).toBe(false);
  });

  it("не показывает скрытое желание, которого нет в ответе сервера", async () => {
    respond(giftsAnswer([gift()]));
    await mount();

    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Секретный подарок");
  });

  it("пустой список говорит «Пока нет открытых желаний», а не «Вишлист недоступен»", async () => {
    respond(giftsAnswer([]));
    await mount();

    expect(text()).toContain("Пока нет открытых желаний");
    expect(text()).not.toContain("Вишлист недоступен");
    expect(button("Куплю сам")).toBeUndefined();
  });

  it("если сервер не вернул ни одного видимого желания, пустое состояние не намекает на скрытые", async () => {
    // The server filtered out every FRIENDS/SECRET wish; the screen only sees the
    // closed `gifts: []` answer and must not invent a count, a title or a reason.
    respond(giftsAnswer([], owner));
    await mount();

    expect(text()).toContain("Аня");
    expect(text()).toContain("Пока нет открытых желаний");
    expect(text()).not.toContain("Вишлист недоступен");
    expect(text()).not.toContain("Для друзей");
    expect(text()).not.toContain("Секрет");
    expect(text()).not.toContain("Всем");
  });

  it("not_found говорит «Вишлист недоступен» и не выдаёт пустой список", async () => {
    respond(notFoundAnswer());
    await mount();

    expect(text()).toContain("Вишлист недоступен");
    expect(text()).toContain("Ссылка недействительна или доступ к вишлисту закрыт.");
    expect(text()).toContain("Мой вишлист");
    // The closed state never says «не найден»: it must not reveal whether the
    // token exists but is hidden or does not exist at all.
    expect(text()).not.toContain("Список не найден");
    expect(text()).not.toContain("Пока нет открытых желаний");
    expect(document.querySelector('[data-testid="wishlist-owner"]')).toBeNull();
    expect(document.querySelector('[data-testid="wishlist-unavailable"]')).not.toBeNull();
    // L8: the closed state also has exactly one level-1 heading.
    expect(container.querySelectorAll('[role="heading"][aria-level="1"]')).toHaveLength(1);
  });

  it("NOT_FOUND и найденный ответ без владельца дают один и тот же нейтральный экран без данных", async () => {
    respond({ ok: false, code: "NOT_FOUND", message: "Not found" });
    await mount();

    expect(text()).toContain("Вишлист недоступен");
    expect(text()).not.toContain("Список не найден");
    expect(text()).not.toContain("Наушники");
    expect(document.querySelector('[data-testid="wishlist-owner"]')).toBeNull();
  });

  it("ответ без владельца — тот же закрытый гейт, имя не выдумывается", async () => {
    respond({ ok: true, data: { access: "gifts", gifts: [gift()] } });
    await mount();

    expect(text()).toContain("Вишлист недоступен");
    expect(text()).not.toContain("Наушники");
  });

  it("пока грузится, показывает skeleton с подписью и не показывает карточки", async () => {
    respond(new Promise(() => {}));
    await mount();

    const region = loadingRegion();
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем вишлист");
    expect(
      container.querySelectorAll('[data-testid="wish-card-skeleton"]'),
    ).toHaveLength(3);
    expect(text()).not.toContain("Наушники");
  });

  it("ошибка сети даёт текст, toast и «Повторить», который перезагружает список", async () => {
    respond({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(container.querySelector('[data-testid="wishlist-error"]')).not.toBeNull();
    expect(button("Повторить")).toBeDefined();

    respond(giftsAnswer([gift()]));
    await press("Повторить");

    expect(text()).toContain("Аня");
    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
  });

  it("ответ не по контракту не рисуется и даёт общий текст ошибки", async () => {
    respond(giftsAnswer([{ ...gift(), bought: true }]));
    await mount();

    expect(text()).not.toContain("Наушники");
    expect(text()).toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(text()).toContain("Не получилось. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();
  });
});

/**
 * W12.21: the shared wishlist screen lays itself out with the Tamagui media clause
 * `$page-gutter medium:$page-gutter-lg` instead of `useWindowDimensions` +
 * `pageGutter(width)`. The window width is still read for the card grid alone: the
 * card width of `cardGrid` is grid maths, not a CSS breakpoint
 * (`sprint-change-proposal-2026-11-10-ui-polish.md:323`), and the loading skeleton
 * of the link page follows the same grid.
 *
 * The tests pin both halves: the gutter is a CSS media query with the same 600
 * boundary `pageGutter` uses, and the rendered card width is `cardGrid(width)` with
 * the whole row still fitting inside the column. Widths come from the CSS Tamagui
 * actually generated (see `@/test/tamagui-css`), not from a browser layout: real
 * rendering on a phone and in a browser is a manual check.
 *
 * W12.23 moved the numbers to the measured content area: this DOM never lays anything
 * out, so these tests see the `cardGrid(width)` fallback, and the measured path has its
 * own suite below.
 */
describe("W12.21: вишлист по ссылке на медиа-пропсах", () => {
  /**
   * Four wishes as a link visitor sees them: three statuses, one tag pair. A link
   * read only ever carries `PUBLIC` wishes (the server's `VisibilityPolicy` runs
   * before the answer), so the fixture stays reachable.
   */
  const board = [
    gift({
      id: "g1",
      title: "Наушники",
      tags: [
        { catalogId: "tag_dream", label: "мечта" },
        { catalogId: null, label: "на день рождения" },
      ],
    }),
    gift({
      id: "g2",
      title: "Свитер",
      priceAmount: 1050,
      priceCurrency: "BYN",
      status: "RESERVED",
      reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
      reservationLabel: "BOUGHT",
    }),
    gift({
      id: "g3",
      title: "Книга",
      priceAmount: null,
      priceCurrency: null,
      status: "CLOSED",
    }),
    gift({ id: "g4", title: "Плед", quantity: "UNLIMITED" }),
  ];

  /** The one `GLColumn` of the page: the column whose padding is the page gutter. */
  function pageColumn(): HTMLElement {
    const node = container.querySelector<HTMLElement>('[name="GLColumn"]');
    expect(node, "колонка страницы").not.toBeNull();
    return node as HTMLElement;
  }

  /** The first wish card of the grid; it is painted with `cardGrid().cardWidth`. */
  function gridCard(): HTMLElement {
    const node = container.querySelector<HTMLElement>('[role="list"] [role="listitem"]');
    expect(node, "карточка желания").not.toBeNull();
    return node as HTMLElement;
  }

  /** The width an element is painted with, as a number of pixels. */
  function paintedWidth(element: Element, width: number): number {
    return Number.parseFloat(paintedValue(element, "width", width) ?? "");
  }

  /**
   * Mounts the screen as a browser at `width` would: the `resize` event makes
   * react-native-web's `useWindowDimensions` deliver the new value — the very hook
   * the screen keeps for the grid.
   */
  async function mountAt(width: number, answer: unknown = giftsAnswer(board)) {
    await setViewportWidth(width);
    respond(answer);
    await mount();
  }

  /** Replaces the mounted screen with a fresh one at another width. */
  async function remountAt(width: number, answer: unknown = giftsAnswer(board)) {
    await act(async () => root.unmount());
    root = createRoot(container);
    await mountAt(width, answer);
  }

  it.each([360, 600, 1024, 1280])(
    "ширина %ipx: отступ колонки — как у pageGutter",
    async (width) => {
      await mountAt(width);

      expect(paintedSpace(pageColumn(), "padding-inline", width)).toBe(pageGutter(width));
    },
  );

  it("граница одна и та же: 16 до bp-medium, 24 от bp-medium", async () => {
    await mountAt(360);
    const element = pageColumn();

    expect(paintedSpace(element, "padding-inline", 360)).toBe(spacing["page-gutter"]);
    expect(paintedSpace(element, "padding-inline", breakpoints.medium - 1)).toBe(
      spacing["page-gutter"],
    );
    expect(paintedSpace(element, "padding-inline", breakpoints.medium)).toBe(
      spacing["page-gutter-lg"],
    );
    expect(paintedSpace(element, "padding-inline", 1280)).toBe(spacing["page-gutter-lg"]);
  });

  it("меняется только на одной медиа-точке, без лишних правил", async () => {
    await mountAt(360);
    const gutterRules = declarationsFor(pageColumn(), "padding-inline");

    expect(gutterRules).toHaveLength(2);
    const conditions = gutterRules.map((rule) => rule.minWidth);
    expect(conditions).toContain(null);
    expect(conditions).toContain(breakpoints.medium);
  });

  it.each([
    { width: 360, columns: 2 },
    { width: 599, columns: 2 },
    { width: 600, columns: 2 },
    { width: 1023, columns: 2 },
    { width: 1024, columns: 3 },
    { width: 1280, columns: 3 },
  ])(
    "ширина $width px: $columns колонка(и), карточка с CSS-отступом не шире колонки",
    async ({ width, columns }) => {
      await mountAt(width);
      const cssGutter = paintedSpace(pageColumn(), "padding-inline", width) ?? 0;
      const cardWidth = paintedWidth(gridCard(), width);
      const gap = spacing["grid-gap"];

      // The window still reaches the grid — and only the grid: the count and the
      // width of the cards are `cardGrid` maths, the gutter above is CSS.
      expect(cardGrid(width).columns).toBe(columns);
      expect(cardWidth).toBeCloseTo(cardGrid(width).cardWidth, 5);
      expect(cssGutter).toBe(pageGutter(width));

      // Grid and CSS gutter agree on the same 600 boundary: the whole row fits the
      // column `min(window, max-wide)` (the W12.15/W12.19 pattern).
      const row = columns * cardWidth + (columns - 1) * gap + cssGutter * 2;
      expect(row).toBeLessThanOrEqual(Math.min(width, spacing["max-wide"]) + 1e-6);
    },
  );

  it("скелетон загрузки получает ту же ширину карточки из cardGrid", async () => {
    await mountAt(1024, new Promise(() => {}));

    const skeleton = container.querySelector<HTMLElement>('[data-testid="wish-card-skeleton"]');
    expect(skeleton).not.toBeNull();
    expect(paintedWidth(skeleton as Element, 1024)).toBeCloseTo(cardGrid(1024).cardWidth, 5);
  });

  it("отступ не зависит от ширины окна, а до сетки ширина доходит (контроль)", async () => {
    await mountAt(360);
    const narrowRules = declarationsFor(pageColumn(), "padding-inline").map(
      (rule) => `${rule.minWidth}:${rule.value}`,
    );
    const narrowCard = gridCard().className;

    await remountAt(1280);

    // The gutter is the same CSS at both widths: the window width never touches it.
    expect(
      declarationsFor(pageColumn(), "padding-inline").map(
        (rule) => `${rule.minWidth}:${rule.value}`,
      ),
    ).toEqual(narrowRules);
    // The control: the grid really reads the window, so the equality above is not
    // «green by inertia».
    expect(gridCard().className).not.toBe(narrowCard);
    expect(paintedWidth(gridCard(), 1280)).toBeCloseTo(cardGrid(1280).cardWidth, 5);
  });

  it("отступ не зависит от JS-ширины, а сетка её читает (мокнутая ширина)", async () => {
    // The JS width says «широкий экран» while the CSS width stays at 360: the
    // gutter must follow the CSS media rule, the cards must follow the JS width.
    dimensions.width = 1280;
    await mountAt(360);

    expect(paintedSpace(pageColumn(), "padding-inline", 360)).toBe(spacing["page-gutter"]);
    expect(paintedWidth(gridCard(), 360)).toBeCloseTo(cardGrid(1280).cardWidth, 5);
  });

  it("экран не импортирует pageGutter: отступ приходит из CSS", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../app/(link)/wishlist/[token].tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/\bpageGutter\b/);
  });

  it("экран отрисован: имя владельца, сетка из трёх желаний, «Уже подарено» и подвал", async () => {
    await mountAt(1024);

    expect(container.querySelector('[data-testid="public-wishlist-page"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="wishlist-owner"]')?.textContent).toContain(
      "Аня",
    );
    expect(container.querySelector('[role="heading"][aria-level="1"]')?.textContent).toBe(
      "Аня",
    );
    // Story 5.3: the closed wish is in «Уже подарено», not in the active grid.
    expect(container.querySelectorAll('[role="list"] [role="listitem"]')).toHaveLength(3);
    expect(text()).toContain("Уже подарено");
    expect(text()).toContain("мечта");
    expect(text()).toContain("на день рождения");
    expect(container.querySelector('[data-testid="page-footer"]')).not.toBeNull();
  });

  it("отступы и gap контента — токены $2/$section-gap/$grid-gap с прежними px", async () => {
    await mountAt(1024);
    const body = findByPaint(container, "padding-top", "2");

    expect(body, "контент вишлиста").toBeDefined();
    expect(paintedValue(body as Element, "padding-top", 360)).toBe("var(--t-space-2)");
    expect(paintedSpace(body as Element, "padding-top", 360)).toBe(spacing["grid-gap"] / 2);
    expect(paintedSpace(body as Element, "padding-bottom", 360)).toBe(spacing["section-gap"]);
    expect(paintedSpace(body as Element, "gap", 360)).toBe(spacing["grid-gap"]);
  });

  /**
   * W12.23: the grid follows the measured content area, not the window. A 600 px window
   * with a classic ~15 px scrollbar leaves a 585 px column, so the cards get
   * 585 − 2·24 = 537 px of content; v8 puts two cards in it, and the right gutter is
   * 24 px again. Without a scrollbar the numbers are the ones the width tests pinned.
   */
  describe("W12.23: сетка по ширине контента", () => {
    it("окно 600 px, колонка 537 px: две карточки, ряд влезает в колонку", async () => {
      await mountAt(600);
      await measuredLayout.measure(537);

      const cssGutter = paintedSpace(pageColumn(), "padding-inline", 600) ?? 0;
      const cardWidth = paintedWidth(gridCard(), 600);

      expect(cssGutter).toBe(spacing["page-gutter-lg"]);
      expect(cardWidth).toBeCloseTo(cardGridForContent(537).cardWidth, 5);
      expect(cardGridForContent(537).columns).toBe(2);
      // Two cards and the gap fill the 537 px column exactly, so the right edge of the
      // last card sits on the 24 px gutter and not 9 px from it.
      expect(cardWidth * 2 + spacing["grid-gap"]).toBeCloseTo(537, 5);
      expect(cardWidth * 2 + spacing["grid-gap"] + cssGutter * 2).toBe(585);
    });

    it.each([
      { width: 360, columns: 2, card: 156 },
      { width: 600, columns: 2, card: 268 },
      { width: 1024, columns: 3, card: 314.67 },
      { width: 1280, columns: 3, card: 346.67 },
    ])(
      "окно $width px без скроллбара: карточка $card px — прежние числа",
      async ({ width, columns, card }) => {
        await mountAt(width);
        const gutter = pageGutter(width);
        const content = Math.min(width, spacing["max-wide"]) - gutter * 2;
        await measuredLayout.measure(content);

        const cardWidth = paintedWidth(gridCard(), width);

        expect(cardGrid(width).columns).toBe(columns);
        expect(cardWidth).toBeCloseTo(card, 2);
        expect(cardWidth).toBeCloseTo(cardGrid(width).cardWidth, 5);

        const row = cardWidth * columns + spacing["grid-gap"] * (columns - 1) + gutter * 2;
        expect(row).toBeLessThanOrEqual(Math.min(width, spacing["max-wide"]) + 1e-6);
      },
    );
  });
});

/**
 * Story 5.3 (SECTION_VIEWER): закрытые желания зрителя лежат в свёрнутой секции
 * «Уже подарено» без действий. Сервер уже отфильтровал видимость, поэтому экран
 * только раскладывает карточки по двум секциям.
 */
describe("вишлист по ссылке: закрытые желания", () => {
  const closed = gift({
    id: "g-closed",
    title: "Свитер",
    status: "CLOSED",
    undoUntil: null,
  });

  it("«Уже подарено» свёрнута: карточка закрытого не в дереве, сетка активных на месте", async () => {
    respond(giftsAnswer([gift(), closed]));
    await mount();

    expect(text()).toContain("Уже подарено");
    expect(container.querySelector('[data-testid="wishlist-closed-toggle"]')?.getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(container.querySelectorAll('[role="list"] [role="listitem"]')).toHaveLength(1);
    expect(text()).not.toContain("Свитер");
  });

  it("раскрытая секция показывает закрытое желание без действий", async () => {
    respond(giftsAnswer([gift(), closed]));
    await mount();

    await press("Уже подарено");

    const section = container.querySelector('[data-testid="wishlist-closed"]');
    expect(section).not.toBeNull();
    expect(section?.textContent).toContain("Свитер");
    expect(container.querySelector('[data-testid="wishlist-closed-toggle"]')?.getAttribute("aria-expanded")).toBe(
      "true",
    );

    // No owner's ⋯ and none of its items: the viewer only reads the card.
    expect(section?.querySelector('[aria-haspopup="dialog"]')).toBeNull();
    expect(text()).not.toContain("Хочу ещё такой");
    expect(text()).not.toContain("Отметить полученным");
    expect(text()).not.toContain("Вернуть в открытые");
  });

  it("одни закрытые желания: списка активных нет, секция и заголовок владельца на месте", async () => {
    respond(giftsAnswer([closed]));
    await mount();

    expect(container.querySelectorAll('[role="list"] [role="listitem"]')).toHaveLength(0);
    expect(text()).toContain("Уже подарено");
    expect(text()).not.toContain("Пока нет открытых желаний");
    expect(dialogElement()).toBeNull();
  });
});
