// @vitest-environment happy-dom
import { breakpoints, spacing } from "@gift-list/ui";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, dialogElement, settle } from "@/test/dom";
import { observeContentWidth, type SimulatedContent } from "@/test/layout";
import { declarationsFor, findByPaint, paintedSpace, paintedValue } from "@/test/tamagui-css";
import { cardGrid, cardGridForContent, pageGutter } from "@/ui/card-grid";
import ProfileScreen from "../../app/(app)/u/[nick]";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(),
  setParams: vi.fn(),
}));
const search = vi.hoisted(() => ({
  params: {} as Record<string, string | undefined>,
}));
/** A JS width a test hands the screen instead of the one `clientWidth` reports. */
const dimensions = vi.hoisted(() => ({ width: null as number | null }));

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => store);
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
  return {
    router: navigation,
    Stack: { Screen: () => null },
    // An honest `asChild`: the router's `Link` hands `href` and `onPress` to its
    // only child (the wish card is the anchor) and draws nothing of its own.
    Link: function Link({
      href,
      asChild,
      children,
    }: {
      href?: unknown;
      asChild?: boolean;
      children?: React.ReactElement<Record<string, unknown>>;
    }) {
      const target =
        typeof href === "string"
          ? href
          : (href as { pathname?: string } | null | undefined)?.pathname;
      if (!asChild) return React.createElement("a", { href: target }, children);
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        href: target,
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

const owner = { displayName: "Борис", nick: "boris" };

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

function giftsAnswer(
  cards: unknown[],
  ownerBlock: unknown = owner,
  relationship: string | undefined = "NONE",
  inviteCooldown?: unknown,
  subscribed?: boolean,
  details?: unknown,
  dates?: unknown,
) {
  return {
    ok: true,
    data: {
      access: "gifts",
      gifts: cards,
      ...(ownerBlock === undefined ? {} : { owner: ownerBlock }),
      ...(relationship === undefined ? {} : { relationship }),
      ...(inviteCooldown === undefined ? {} : { inviteCooldown }),
      ...(subscribed === undefined ? {} : { subscribed }),
      ...(details === undefined ? {} : { details }),
      ...(dates === undefined ? {} : { dates }),
    },
  };
}

function inviteAnswer(outcome: string) {
  return { ok: true, data: { outcome } };
}

function subscriptionAnswer(outcome: string) {
  return { ok: true, data: { outcome } };
}

function notFoundAnswer() {
  return { ok: false, code: "NOT_FOUND", message: "Not found" };
}

/** `/api/v1/me` answers with the session; every other path answers with the profile. */
function respond(profile: unknown, session: unknown = { ok: true, data: user }) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(path === "/api/v1/me" ? session : profile),
  );
}

function profileReads(): number {
  return api.apiRequest.mock.calls.filter(([path]) => {
    const value = String(path);
    return (
      value.startsWith("/api/v1/u/") &&
      !value.includes("/invite") &&
      !value.endsWith("/subscription") &&
      !value.endsWith("/friend") &&
      !value.endsWith("/block")
    );
  }).length;
}

function friendRemoveCalls(): number {
  return api.apiRequest.mock.calls.filter(
    ([path, init]) =>
      String(path).endsWith("/friend") &&
      (init as { method?: string } | undefined)?.method === "DELETE",
  ).length;
}

/** Story 4.5: the block request of the profile, `POST` on the nick's route. */
function blockCalls(): number {
  return api.apiRequest.mock.calls.filter(
    ([path, init]) =>
      String(path).endsWith("/block") &&
      (init as { method?: string } | undefined)?.method === "POST",
  ).length;
}

function subscriptionCalls(method: "POST" | "DELETE"): number {
  return api.apiRequest.mock.calls.filter(
    ([path, init]) =>
      String(path).endsWith("/subscription") &&
      (init as { method?: string } | undefined)?.method === method,
  ).length;
}

function inviteCalls(): number {
  return api.apiRequest.mock.calls.filter(([path]) =>
    String(path).endsWith("/invite"),
  ).length;
}

function actionCalls(suffix: string): number {
  return api.apiRequest.mock.calls.filter(([path]) =>
    String(path).endsWith(`/invite/${suffix}`),
  ).length;
}

let root: Root;
let container: HTMLElement;
/** W12.23: the content width a browser would report for the column. */
let measuredLayout: SimulatedContent;

function text(): string {
  return document.body.textContent ?? "";
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

/** A press on a control of the open layer, matched by its exact visible text. */
async function pressInDialog(label: string) {
  const dialog = dialogElement();
  expect(dialog, "открытый диалог").not.toBeNull();
  const target = controls(dialog ?? undefined).find(
    (node) => (node.textContent ?? "").trim() === label,
  );
  expect(target, `кнопка «${label}» в диалоге`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/** «Удалить из друзей» on the profile, then the confirm it opens. */
async function openRemoveConfirm() {
  await press("Удалить из друзей");
  await settle(60);
  expect(dialogElement()?.textContent).toContain("Удалить Борис из друзей?");
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <ProfileScreen />
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

async function rerenderWithNick(nick: string) {
  await act(async () => {
    search.params = { nick };
    root.render(
      <AuthProvider>
        <ProfileScreen />
      </AuthProvider>,
    );
  });
  await settle(10);
}

beforeEach(() => {
  vi.resetAllMocks();
  dimensions.width = null;
  measuredLayout = observeContentWidth();
  search.params = { nick: "boris" };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  measuredLayout.restore();
});

describe("профиль: вход", () => {
  it("аноним уходит на вход с безопасным next и не запрашивает профиль", async () => {
    respond(null, { ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/u/boris" },
    });
    expect(profileReads()).toBe(0);
  });

  it.each(["a/b", "a?b", "a#b", "..", "%2f", "ab", "аня"])(
    "небезопасный сегмент %s не уводит на вход, не запрашивает API и даёт 404",
    async (nick) => {
      search.params = { nick };
      respond(giftsAnswer([gift()]));
      await mount();

      expect(navigation.replace).not.toHaveBeenCalled();
      expect(profileReads()).toBe(0);
      expect(text()).toContain("Страница не найдена");
    },
  );

  it("пока сессия неизвестна, профиль не запрашивается и экран не пустой", async () => {
    api.apiRequest.mockImplementation((path: string) =>
      path === "/api/v1/me" ? new Promise(() => {}) : Promise.resolve(giftsAnswer([])),
    );
    await mount();

    expect(profileReads()).toBe(0);
    expect(navigation.replace).not.toHaveBeenCalled();
    const region = container.querySelector('[data-testid="session-loading"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(3);
  });

  it("сетевая ошибка сессии: экран ошибки с «Повторить», без входа и без чтения профиля", async () => {
    respond(null, { ok: false, network: true });
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(profileReads()).toBe(0);
    const region = container.querySelector('[data-testid="session-error"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("alert");
    expect(text()).toContain("Нет связи с сервером");
    expect(button("Повторить")).toBeDefined();
  });

  it("«Повторить» перечитывает сессию и открывает профиль", async () => {
    respond(null, { ok: false, network: true });
    await mount();

    respond(giftsAnswer([gift()]), { ok: true, data: user });
    await press("Повторить");

    expect(api.apiRequest.mock.calls.filter(([path]) => path === "/api/v1/me").length).toBe(2);
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toContain("Борис");
    expect(text()).toContain("Наушники");
  });

  it("истёкшая сессия уводит на вход с тем же next и причиной", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/session") {
        return Promise.resolve({ ok: true, data: { signedOut: true } });
      }
      return Promise.resolve({ ok: false, code: "UNAUTHENTICATED", message: "" });
    });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/u/boris", reason: "session_expired" },
    });
  });
});

describe("профиль: карточка и желания", () => {
  it("рисует имя, ник и все карточки, которые вернул сервер", async () => {
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

    expect(container.querySelector('[data-testid="page-footer"]')).not.toBeNull();
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/boris");
    expect(text()).toContain("Борис");
    expect(text()).toContain("@boris");
    expect(text()).toContain("Наушники");
    expect(text()).toContain("Свитер");
    // The profile has no visibility chip and no hidden count.
    expect(text()).not.toContain("Всем");
    expect(text()).not.toContain("Друзьям");
    expect(text()).not.toContain("Секрет");
  });

  it("не показывает скрытое желание, которого нет в ответе сервера", async () => {
    respond(giftsAnswer([gift()]));
    await mount();

    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Секретный подарок");
  });

  it("при «нет связи» рисует «Добавить в друзья», «Подписаться» и «Заблокировать»", async () => {
    respond(giftsAnswer([]));
    await mount();

    expect(button("Добавить в друзья")).toBeDefined();
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(button("Заблокировать")).toBeDefined();
    expect(button("Отменить приглашение")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();
    expect(text()).not.toContain("Друзья");
  });

  it("пустой набор говорит «Пока нет открытых желаний», а не «Пользователь не найден»", async () => {
    respond(giftsAnswer([]));
    await mount();

    expect(text()).toContain("Пока нет открытых желаний");
    expect(text()).not.toContain("Пользователь не найден");
  });

  it("not_found говорит «Пользователь не найден» и не выдаёт пустой профиль", async () => {
    respond(notFoundAnswer());
    await mount();

    expect(text()).toContain("Пользователь не найден");
    expect(text()).not.toContain("Пока нет открытых желаний");
    expect(document.querySelector('[data-testid="profile-owner"]')).toBeNull();
  });

  it("ответ без владельца — тот же закрытый гейт, имя не выдумывается", async () => {
    respond({ ok: true, data: { access: "gifts", gifts: [gift()] } });
    await mount();

    expect(text()).toContain("Пользователь не найден");
    expect(text()).not.toContain("Наушники");
  });

  it("пока грузится, показывает skeleton с подписью и не показывает карточки", async () => {
    respond(new Promise(() => {}));
    await mount();

    const region = container.querySelector('[data-testid="profile-loading"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("status");
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем профиль");
    expect(
      container.querySelectorAll('[data-testid="wish-card-skeleton"]'),
    ).toHaveLength(3);
    expect(text()).not.toContain("Наушники");
  });

  it("смена ника в параметре не показывает предыдущий профиль", async () => {
    const pending = new Promise(() => {});
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/anya") {
        return Promise.resolve(
          giftsAnswer([gift()], { displayName: "Аня", nick: "anya" }),
        );
      }
      return pending;
    });
    search.params = { nick: "anya" };

    await mount();
    expect(text()).toContain("Аня");
    expect(text()).toContain("Наушники");

    await rerenderWithNick("masha");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/u/masha");
    expect(text()).not.toContain("Аня");
    expect(text()).not.toContain("Наушники");
    expect(container.querySelector('[aria-label="Загружаем профиль"]')).not.toBeNull();
  });

  it("ошибка сети даёт текст, toast и «Повторить», который перезагружает профиль", async () => {
    respond({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();

    respond(giftsAnswer([gift()]));
    await press("Повторить");

    expect(text()).toContain("Борис");
    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
  });

  it("ответ не по контракту не рисуется и даёт общий текст ошибки", async () => {
    respond(giftsAnswer([{ ...gift(), bought: true }]));
    await mount();

    expect(text()).not.toContain("Наушники");
    expect(text()).toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();
  });
});

describe("профиль: поля профиля (CLE-129/T8.4)", () => {
  const details = {
    birthDay: 12,
    birthMonth: 3,
    gender: "MALE",
    country: "BY",
    about: "Люблю горы.\nИ кофе.",
  };

  function detailsBlock(): HTMLElement | null {
    return container.querySelector<HTMLElement>('[data-testid="profile-details"]');
  }

  it("друг видит день рождения, пол, страну и «Обо мне»", async () => {
    respond(giftsAnswer([], owner, "FRIENDS", undefined, undefined, details));
    await mount();

    const block = detailsBlock();
    expect(block).not.toBeNull();
    expect(block?.textContent).toContain("День рождения");
    // «12 марта»: a day and a month, never a year (AD-29).
    expect(block?.textContent).toContain("12 марта");
    expect(block?.textContent).not.toContain("2000");
    expect(block?.textContent).toContain("Пол");
    expect(block?.textContent).toContain("Мужской");
    expect(block?.textContent).toContain("Страна");
    expect(block?.textContent).toContain("Беларусь");
    expect(block?.textContent).toContain("Обо мне");
    // The line break of plain «Обо мне» stays as written.
    expect(block?.querySelector('[data-testid="profile-about"]')?.textContent).toContain(
      "Люблю горы.\nИ кофе.",
    );
    // The avatar circle holds the initials; the name is written next to it.
    const avatar = container.querySelector('[data-testid="profile-avatar"]');
    expect(avatar?.textContent).toBe("Б");
    expect(avatar?.getAttribute("aria-hidden")).toBe("true");
    // Not the own profile: there is no «Изменить» link.
    expect(container.querySelector('[data-testid="profile-edit"]')).toBeNull();
  });

  it("не-друг не видит блока деталей", async () => {
    respond(giftsAnswer([], owner, "NONE"));
    await mount();

    expect(detailsBlock()).toBeNull();
    expect(text()).not.toContain("12 марта");
    expect(text()).not.toContain("Обо мне");
  });

  it("свой профиль показывает те же детали и ведёт в /profile по «Изменить»", async () => {
    search.params = { nick: "anya" };
    respond(
      giftsAnswer(
        [],
        { displayName: "Аня", nick: "anya" },
        "NONE",
        undefined,
        undefined,
        { ...details, profileVisibleToFriends: true },
      ),
    );
    await mount();

    const block = detailsBlock();
    expect(block?.textContent).toContain("12 марта");
    expect(block?.textContent).toContain("Мужской");

    const edit = container.querySelector<HTMLElement>('[data-testid="profile-edit"]');
    expect(edit, "ссылка «Изменить»").not.toBeNull();
    expect(edit?.textContent).toBe("Изменить");
    expect(edit?.getAttribute("aria-label")).toBe("Изменить профиль");

    await act(async () => {
      edit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(navigation.push).toHaveBeenCalledWith("/profile");
  });

  it("пустые поля блока не рендерятся", async () => {
    respond(
      giftsAnswer([], owner, "FRIENDS", undefined, undefined, {
        birthDay: null,
        birthMonth: null,
        gender: null,
        country: null,
        about: null,
      }),
    );
    await mount();

    expect(detailsBlock()).toBeNull();
    expect(text()).not.toContain("День рождения");
    expect(text()).not.toContain("Обо мне");
  });

  it("из блока показываются только заполненные поля", async () => {
    respond(
      giftsAnswer([], owner, "FRIENDS", undefined, undefined, {
        ...details,
        gender: null,
        country: null,
        about: null,
      }),
    );
    await mount();

    const block = detailsBlock();
    expect(block?.textContent).toContain("12 марта");
    expect(block?.querySelector('[data-testid="profile-gender"]')).toBeNull();
    expect(block?.querySelector('[data-testid="profile-country"]')).toBeNull();
    expect(block?.querySelector('[data-testid="profile-about"]')).toBeNull();
  });
});

describe("профиль: личные даты (Story 7.5)", () => {
  function datesBlock(): HTMLElement | null {
    return container.querySelector<HTMLElement>('[data-testid="profile-dates-block"]');
  }

  it("друг видит даты, которые отдал сервер: дата без года и с годом", async () => {
    respond(
      giftsAnswer(
        [],
        owner,
        "FRIENDS",
        undefined,
        undefined,
        undefined,
        [
          { id: "d1", kind: "CUSTOM", title: "Годовщина свадьбы", day: 14, month: 3, year: null },
          { id: "d2", kind: "CUSTOM", title: "День рождения мамы", day: 2, month: 9, year: 1958 },
        ],
      ),
    );
    await mount();

    const block = datesBlock();
    expect(block).not.toBeNull();
    expect(block?.textContent).toContain("Даты");
    expect(block?.textContent).toContain("Годовщина свадьбы");
    expect(block?.textContent).toContain("14.03");
    expect(block?.textContent).not.toContain("14.03.2000");
    expect(block?.textContent).toContain("02.09.1958");
  });

  it("пустой список дат блок не рисует", async () => {
    respond(giftsAnswer([], owner, "FRIENDS", undefined, undefined, undefined, []));
    await mount();

    expect(datesBlock()).toBeNull();
    expect(text()).not.toContain("Годовщина");
  });

  it("без поля dates в ответе блока тоже нет", async () => {
    respond(giftsAnswer([], owner, "NONE"));
    await mount();

    expect(datesBlock()).toBeNull();
  });
});

describe("профиль: принятие и отказ (Story 4.2.3)", () => {
  it("входящий pending: рядом «Принять приглашение», «Отклонить», «Подписаться» и блок", async () => {
    respond(giftsAnswer([], owner, "INCOMING_PENDING"));
    await mount();

    expect(text()).toContain("Зовёт в друзья");
    expect(button("Принять приглашение")).toBeDefined();
    expect(button("Отклонить")).toBeDefined();
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(button("Заблокировать")).toBeDefined();
    expect(button("Отменить приглашение")).toBeUndefined();
  });

  it("отказ: перечитывает профиль, у отклонившего нет chip «Отклонено», есть часы", async () => {
    let rejected = false;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite/reject") {
        rejected = true;
        return Promise.resolve(inviteAnswer("REJECTED"));
      }
      return Promise.resolve(
        rejected
          ? giftsAnswer([], owner, "NONE", { hours: 23, rejected: false })
          : giftsAnswer([], owner, "INCOMING_PENDING"),
      );
    });
    await mount();

    expect(button("Отклонить")).toBeDefined();
    await press("Отклонить");

    expect(actionCalls("reject")).toBe(1);
    expect(inviteCalls()).toBe(0);
    expect(profileReads()).toBe(2);
    expect(text()).not.toContain("Зовёт в друзья");
    expect(text()).not.toContain("Отклонено");
    expect(text()).toContain("Можно снова через 23 ч");
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();
    expect(button("Отменить приглашение")).toBeUndefined();

    const add = button("Добавить в друзья");
    expect(add).toBeDefined();
    expect(add?.getAttribute("aria-disabled")).toBe("true");
  });

  it("отправитель после отказа: chip «Отклонено», кнопки новой заявки нет", async () => {
    respond(giftsAnswer([], owner, "NONE", { hours: 5, rejected: true }));
    await mount();

    expect(text()).toContain("Отклонено");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();
    expect(button("Отменить приглашение")).toBeUndefined();
    expect(text()).not.toContain("Можно снова через");
  });

  it("после принятия оба видят chip «Друзья» и только желания из ответа сервера", async () => {
    let accepted = false;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite/accept") {
        accepted = true;
        return Promise.resolve(inviteAnswer("FRIENDS_CREATED"));
      }
      return Promise.resolve(
        accepted
          ? giftsAnswer(
              [
                gift(),
                gift({ id: "g2", title: "Свитер", visibility: "FRIENDS" }),
              ],
              owner,
              "FRIENDS",
              undefined,
              undefined,
              { birthDay: null, birthMonth: null, gender: null, country: null, about: "Люблю горы" },
            )
          : giftsAnswer([], owner, "INCOMING_PENDING"),
      );
    });
    await mount();
    expect(text()).not.toContain("Люблю горы");

    await press("Принять приглашение");

    expect(actionCalls("accept")).toBe(1);
    expect(profileReads()).toBe(2);
    expect(text()).toContain("Друзья");
    expect(text()).toContain("Наушники");
    expect(text()).toContain("Свитер");
    expect(text()).toContain("Люблю горы");
    expect(text()).not.toContain("Зовёт в друзья");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();
  });

  it("свой профиль: ни принятия, ни отказа, ни cooldown, ни блока", async () => {
    search.params = { nick: "anya" };
    respond(
      giftsAnswer([], { displayName: "Аня", nick: "anya" }, "NONE", {
        hours: 4,
        rejected: false,
      }),
    );
    await mount();

    expect(text()).toContain("Это вы");
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Заблокировать")).toBeUndefined();
    expect(text()).not.toContain("Можно снова через");
  });

  it("повторное нажатие «Отклонить» не отправляет второй запрос", async () => {
    let resolveReject: (value: unknown) => void = () => {};
    const reject = new Promise((resolve) => {
      resolveReject = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite/reject") return reject;
      return Promise.resolve(giftsAnswer([], owner, "INCOMING_PENDING"));
    });
    await mount();

    const target = button("Отклонить");
    await act(async () => {
      target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(actionCalls("reject")).toBe(1);

    await act(async () => resolveReject(inviteAnswer("REJECTED")));
    await settle(10);
  });

  it("сеть при отказе: cooldown откатывается, кнопки возвращаются, тост остаётся", async () => {
    let resolveReject: (value: unknown) => void = () => {};
    const reject = new Promise((resolve) => {
      resolveReject = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite/reject") return reject;
      return Promise.resolve(giftsAnswer([], owner, "INCOMING_PENDING"));
    });
    await mount();

    await press("Отклонить");

    expect(text()).toContain("Можно снова через 24 ч");
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();

    await act(async () => resolveReject({ ok: false, network: true }));
    await settle(10);

    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(text()).not.toContain("Можно снова через");
    expect(text()).toContain("Зовёт в друзья");
    expect(button("Принять приглашение")).toBeDefined();
    expect(button("Отклонить")).toBeDefined();
  });

  it("сеть при принятии: chip дружбы откатывается, входящее возвращается", async () => {
    let resolveAccept: (value: unknown) => void = () => {};
    const accept = new Promise((resolve) => {
      resolveAccept = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite/accept") return accept;
      return Promise.resolve(giftsAnswer([], owner, "INCOMING_PENDING"));
    });
    await mount();

    await press("Принять приглашение");

    expect(text()).toContain("Друзья");
    expect(button("Отклонить")).toBeUndefined();

    await act(async () => resolveAccept({ ok: false, network: true }));
    await settle(10);

    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(text()).toContain("Зовёт в друзья");
    expect(button("Принять приглашение")).toBeDefined();
    expect(button("Отклонить")).toBeDefined();
  });
});

describe("профиль: приглашение в друзья (Story 4.1.3)", () => {
  function expectNoForeignActions() {
    expect(button("Отменить приглашение")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();
  }

  it("нет связи: оптимистичный «Ожидает ответа», тост и исчезнувшая кнопка", async () => {
    let resolveInvite: (value: unknown) => void = () => {};
    const invite = new Promise((resolve) => {
      resolveInvite = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") return invite;
      return Promise.resolve(giftsAnswer([gift()]));
    });
    await mount();

    const add = button("Добавить в друзья");
    expect(add).toBeDefined();
    expect(add?.getAttribute("aria-label")).toBe("Добавить в друзья");
    expect(text()).not.toContain("Друзья");

    await press("Добавить в друзья");

    expect(inviteCalls()).toBe(1);
    expect(text()).toContain("Ожидает ответа");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(text()).not.toContain("Друзья");

    await act(async () => resolveInvite(inviteAnswer("INVITED")));
    await settle(10);

    expect(text()).toContain("Приглашение отправлено");
    expect(text()).toContain("Ожидает ответа");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
    expectNoForeignActions();
  });

  it("исходящий pending: только «Ожидает ответа», без второй отправки и отмены", async () => {
    respond(giftsAnswer([], owner, "OUTGOING_PENDING"));
    await mount();

    expect(text()).toContain("Ожидает ответа");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
    expectNoForeignActions();
  });

  it("входящий pending: «Принять приглашение» идёт в accept, даёт дружбу и перечитывает желания", async () => {
    let accepted = false;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite/accept") {
        accepted = true;
        return Promise.resolve(inviteAnswer("FRIENDS_CREATED"));
      }
      return Promise.resolve(
        accepted
          ? giftsAnswer(
              [gift({ id: "g2", title: "Свитер", visibility: "FRIENDS" })],
              owner,
              "FRIENDS",
            )
          : giftsAnswer([gift()], owner, "INCOMING_PENDING"),
      );
    });
    await mount();

    expect(text()).toContain("Зовёт в друзья");
    expect(button("Принять приглашение")).toBeDefined();
    expect(button("Отклонить")).toBeDefined();
    expect(button("Добавить в друзья")).toBeUndefined();

    await press("Принять приглашение");

    expect(actionCalls("accept")).toBe(1);
    expect(inviteCalls()).toBe(0);
    expect(text()).toContain("Борис теперь в друзьях");
    expect(text()).toContain("Друзья");
    expect(text()).toContain("Свитер");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();
    expect(button("Подписаться")).toBeUndefined();
    expect(button("Отписаться")).toBeUndefined();
    expectNoForeignActions();
  });

  it("уже друзья: chip «Друзья», «Удалить из друзей» и «Заблокировать», без прочих действий", async () => {
    respond(giftsAnswer([], owner, "FRIENDS"));
    await mount();

    expect(text()).toContain("Друзья");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Подписаться")).toBeUndefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(button("Удалить из друзей")).toBeDefined();
    expect(button("Заблокировать")).toBeDefined();
    expectNoForeignActions();
  });

  it("свой профиль: chip «Это вы» и никаких действий", async () => {
    search.params = { nick: "anya" };
    respond(giftsAnswer([], { displayName: "Аня", nick: "anya" }, "NONE"));
    await mount();

    expect(text()).toContain("Это вы");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Подписаться")).toBeUndefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(button("Удалить из друзей")).toBeUndefined();
    expect(button("Заблокировать")).toBeUndefined();
    expectNoForeignActions();
  });

  it("not_found: «Пользователь не найден.» без кнопки", async () => {
    respond(notFoundAnswer());
    await mount();

    expect(text()).toContain("Пользователь не найден.");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Заблокировать")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
  });

  it("сеть: оптимистичный chip откатывается, кнопка возвращается, тост остаётся", async () => {
    let rejectInvite: (value: unknown) => void = () => {};
    const invite = new Promise((resolve) => {
      rejectInvite = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") return invite;
      return Promise.resolve(giftsAnswer([]));
    });
    await mount();

    await press("Добавить в друзья");

    expect(text()).toContain("Ожидает ответа");
    expect(button("Добавить в друзья")).toBeUndefined();

    await act(async () => rejectInvite({ ok: false, network: true }));
    await settle(10);

    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(text()).not.toContain("Ожидает ответа");
    expect(button("Добавить в друзья")).toBeDefined();
    expect(inviteCalls()).toBe(1);
  });

  it("413 на приглашении: причина локализуется, кнопка возвращается", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") {
        return Promise.resolve({
          ok: false,
          code: "VALIDATION",
          message: "Payload too large",
          reason: "PAYLOAD_TOO_LARGE",
        });
      }
      return Promise.resolve(giftsAnswer([]));
    });
    await mount();

    await press("Добавить в друзья");

    expect(text()).toContain("Слишком большой запрос. Сократите текст и попробуйте ещё раз.");
    expect(text()).not.toContain("Payload too large");
    expect(text()).not.toContain("Ожидает ответа");
    expect(button("Добавить в друзья")).toBeDefined();
    expect(inviteCalls()).toBe(1);
  });

  it("повторное нажатие не отправляет второй запрос", async () => {
    let resolveInvite: (value: unknown) => void = () => {};
    const invite = new Promise((resolve) => {
      resolveInvite = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") return invite;
      return Promise.resolve(giftsAnswer([]));
    });
    await mount();

    const add = button("Добавить в друзья");
    await act(async () => {
      add?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      add?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(inviteCalls()).toBe(1);

    await act(async () => resolveInvite(inviteAnswer("INVITED")));
    await settle(10);
  });

  it("ответ старого ника после смены маршрута не меняет новый профиль", async () => {
    let resolveInvite: (value: unknown) => void = () => {};
    const invite = new Promise((resolve) => {
      resolveInvite = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") return invite;
      if (path === "/api/v1/u/masha") {
        return Promise.resolve(
          giftsAnswer([], { displayName: "Маша", nick: "masha" }, "NONE"),
        );
      }
      return Promise.resolve(giftsAnswer([], owner, "NONE"));
    });
    await mount();

    await press("Добавить в друзья");
    expect(text()).toContain("Ожидает ответа");

    await rerenderWithNick("masha");

    expect(text()).toContain("Маша");
    expect(text()).not.toContain("Ожидает ответа");
    expect(button("Добавить в друзья")).toBeDefined();

    await act(async () => resolveInvite(inviteAnswer("FRIENDS_CREATED")));
    await settle(10);

    expect(text()).not.toContain("Борис теперь в друзьях");
    expect(text()).not.toContain("Друзья");
    expect(button("Добавить в друзья")).toBeDefined();
  });

  it("401 при отправке уводит на вход с прежним безопасным next", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") {
        return Promise.resolve({ ok: false, code: "UNAUTHENTICATED", message: "" });
      }
      if (path === "/api/v1/session") {
        return Promise.resolve({ ok: true, data: { signedOut: true } });
      }
      return Promise.resolve(giftsAnswer([]));
    });
    await mount();

    await press("Добавить в друзья");

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/u/boris", reason: "session_expired" },
    });
  });
});

/**
 * Story 4.4: a friend's profile offers «Удалить из друзей» next to the «Друзья»
 * chip, with the same confirm as the friends list. The optimistic former friend
 * loses the `FRIENDS` wishes at once; the server then owns the reread.
 */
describe("профиль: удаление из друзей (Story 4.4)", () => {
  function friendAnswer(cards: unknown[], relationship: string) {
    return giftsAnswer(cards, owner, relationship);
  }

  it("у друга есть «Удалить из друзей» и «Заблокировать»; «Отмена» не удаляет", async () => {
    respond(friendAnswer([], "FRIENDS"));
    await mount();

    expect(text()).toContain("Друзья");
    expect(button("Удалить из друзей")).toBeDefined();
    expect(button("Заблокировать")).toBeDefined();
    expect(button("Подписаться")).toBeUndefined();

    await openRemoveConfirm();
    expect(dialogElement()?.textContent).toContain(
      "Желания «друзьям» перестанут быть видны друг другу. Брони останутся.",
    );
    expect(friendRemoveCalls()).toBe(0);

    await pressInDialog("Отмена");

    expect(friendRemoveCalls()).toBe(0);
    expect(text()).toContain("Друзья");
    expect(button("Удалить из друзей")).toBeDefined();
    expect(text()).not.toContain("удалён из друзей");
  });

  it("confirm удаляет: FRIENDS-желания скрыты сразу, toast, профиль остаётся открытым", async () => {
    let removed = false;
    let resolveRemove: (value: unknown) => void = () => {};
    const removal = new Promise((resolve) => {
      resolveRemove = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/friend") {
        removed = true;
        return removal;
      }
      return Promise.resolve(
        giftsAnswer(
          removed
            ? [gift()]
            : [gift(), gift({ id: "g2", title: "Свитер", visibility: "FRIENDS" })],
          owner,
          removed ? "NONE" : "FRIENDS",
          undefined,
          undefined,
          removed ? undefined : { birthDay: null, birthMonth: null, gender: null, country: null, about: "Люблю горы" },
        ),
      );
    });
    await mount();

    expect(text()).toContain("Друзья");
    expect(text()).toContain("Свитер");
    expect(text()).toContain("Люблю горы");

    await openRemoveConfirm();
    await pressInDialog("Удалить");

    expect(friendRemoveCalls()).toBe(1);
    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Свитер");
    expect(text()).not.toContain("Люблю горы");
    expect(text()).not.toContain("Друзья");
    expect(button("Добавить в друзья")).toBeDefined();
    expect(button("Удалить из друзей")).toBeUndefined();

    await act(async () => resolveRemove({ ok: true, data: { outcome: "REMOVED" } }));
    await settle(10);

    expect(text()).toContain("Борис удалён из друзей");
    expect(text()).toContain("Борис");
    expect(text()).not.toContain("Пользователь не найден");
    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Свитер");
    expect(text()).not.toContain("Друзья");
    expect(button("Добавить в друзья")).toBeDefined();
    expect(button("Удалить из друзей")).toBeUndefined();
    expect(button("Подписаться")).toBeDefined();
    expect(button("Заблокировать")).toBeDefined();
    // The profile is reread so the list and the relation come from the server.
    expect(profileReads()).toBe(2);
  });

  it("ALREADY_REMOVED — тоже успех: тот же toast без ошибки", async () => {
    let removed = false;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/friend") {
        removed = true;
        return Promise.resolve({ ok: true, data: { outcome: "ALREADY_REMOVED" } });
      }
      return Promise.resolve(friendAnswer([], removed ? "NONE" : "FRIENDS"));
    });
    await mount();

    await openRemoveConfirm();
    await pressInDialog("Удалить");
    await settle(10);

    expect(text()).toContain("Борис удалён из друзей");
    expect(text()).not.toContain("Не получилось");
    expect(text()).not.toContain("Нет доступа");
  });

  it("при ошибке сети восстанавливаются дружба, желания и «Обо мне» без перечитывания профиля", async function () {
    let resolveRemove: (value: unknown) => void = () => {};
    const removal = new Promise((resolve) => {
      resolveRemove = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/friend") return removal;
      return Promise.resolve(
        giftsAnswer(
          [gift(), gift({ id: "g2", title: "Свитер", visibility: "FRIENDS" })],
          owner,
          "FRIENDS",
          undefined,
          undefined,
          { birthDay: null, birthMonth: null, gender: null, country: null, about: "Люблю горы" },
        ),
      );
    });
    await mount();

    expect(text()).toContain("Люблю горы");
    await openRemoveConfirm();
    await pressInDialog("Удалить");

    expect(text()).not.toContain("Свитер");
    expect(text()).not.toContain("Люблю горы");

    await act(async () => resolveRemove({ ok: false, network: true }));
    await settle(10);

    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(text()).toContain("Друзья");
    expect(text()).toContain("Свитер");
    expect(text()).toContain("Люблю горы");
    expect(button("Удалить из друзей")).toBeDefined();
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(profileReads()).toBe(1);
  });

  it("FORBIDDEN: toast «Нет доступа», чип и желания откатываются", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/friend") {
        return Promise.resolve({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
      }
      return Promise.resolve(
        friendAnswer([gift({ id: "g2", title: "Свитер", visibility: "FRIENDS" })], "FRIENDS"),
      );
    });
    await mount();

    await openRemoveConfirm();
    await pressInDialog("Удалить");
    await settle(10);

    expect(text()).toContain("Нет доступа.");
    expect(text()).toContain("Свитер");
    expect(text()).toContain("Друзья");
    expect(text()).not.toContain("удалён из друзей");
    expect(button("Удалить из друзей")).toBeDefined();
  });

  it("401 при удалении уводит на вход с прежним безопасным next", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/friend") {
        return Promise.resolve({ ok: false, code: "UNAUTHENTICATED", message: "" });
      }
      if (path === "/api/v1/session") {
        return Promise.resolve({ ok: true, data: { signedOut: true } });
      }
      return Promise.resolve(friendAnswer([], "FRIENDS"));
    });
    await mount();

    await openRemoveConfirm();
    await pressInDialog("Удалить");
    await settle(10);

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/u/boris", reason: "session_expired" },
    });
  });
});

describe("профиль: блокировка (Story 4.5)", () => {
  /** The toast's close cross carries the catalogue label «Закрыть». */
  async function closeToast() {
    const close = document.querySelector<HTMLElement>('[aria-label="Закрыть"]');
    expect(close, "крестик тоста").not.toBeNull();
    await act(async () => {
      close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // The fade of `TOAST_FADE_MS` (160 мс) ends with `onDismiss`.
    await settle(300);
  }

  async function openBlockConfirm() {
    await press("Заблокировать");
    await settle(60);
    expect(dialogElement()?.textContent).toContain("Заблокировать Борис?");
  }

  it("confirm называет имя и последствия; «Отмена» не блокирует и оставляет профиль", async () => {
    respond(giftsAnswer([], owner, "FRIENDS"));
    await mount();

    await openBlockConfirm();

    const dialog = dialogElement();
    expect(dialog?.textContent).toContain(
      "Вы перестанете видеть друг друга, дружба и подписки удалятся.",
    );
    expect(dialog?.textContent).not.toContain("бронь");
    expect(dialog?.querySelectorAll("button")).toHaveLength(2);

    await pressInDialog("Отмена");
    await settle(10);

    expect(blockCalls()).toBe(0);
    expect(text()).not.toContain("заблокирован");
    expect(button("Заблокировать")).toBeDefined();
  });

  it("успех: toast, затем уход назад с тем же toast", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/block") {
        return Promise.resolve({ ok: true, data: { outcome: "BLOCKED" } });
      }
      return Promise.resolve(giftsAnswer([], owner, "FRIENDS"));
    });
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await openBlockConfirm();
    await pressInDialog("Заблокировать");
    await settle(10);

    expect(blockCalls()).toBe(1);
    expect(text()).toContain("Борис заблокирован");
    expect(dialogElement()).toBeNull();
    // The toast is still on screen: the leaving waits for it.
    expect(navigation.back).not.toHaveBeenCalled();

    await closeToast();

    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("прямая ссылка без истории уходит на /friends", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/block") {
        return Promise.resolve({ ok: true, data: { outcome: "ALREADY_BLOCKED" } });
      }
      return Promise.resolve(giftsAnswer([]));
    });
    navigation.canGoBack.mockReturnValue(false);
    await mount();

    await openBlockConfirm();
    await pressInDialog("Заблокировать");
    await settle(10);
    await closeToast();

    expect(navigation.replace).toHaveBeenCalledWith("/friends");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("сеть: профиль остаётся, toast «Нет сети», уход не заказан", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/block") {
        return Promise.resolve({ ok: false, network: true });
      }
      return Promise.resolve(giftsAnswer([], owner, "FRIENDS"));
    });
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await openBlockConfirm();
    await pressInDialog("Заблокировать");
    await settle(10);

    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(text()).not.toContain("заблокирован");
    expect(container.querySelector('[data-testid="profile-owner"]')).not.toBeNull();
    expect(button("Заблокировать")).toBeDefined();
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("401 при блоке уводит на вход с прежним безопасным next", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/block") {
        return Promise.resolve({ ok: false, code: "UNAUTHENTICATED", message: "" });
      }
      if (path === "/api/v1/session") {
        return Promise.resolve({ ok: true, data: { signedOut: true } });
      }
      return Promise.resolve(giftsAnswer([]));
    });
    await mount();

    await openBlockConfirm();
    await pressInDialog("Заблокировать");
    await settle(10);

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/u/boris", reason: "session_expired" },
    });
  });
});

describe("профиль: устаревший cooldown сервера (Story 4.2)", () => {
  function cooldownError(hours: unknown) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "",
      reason: "INVITE_COOLDOWN",
      params: hours === undefined ? undefined : { hours },
    };
  }

  it("устаревшее «нет связи» у отправителя: часы, «Отклонено» и перечитанный профиль", async () => {
    let coolingDown = false;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") {
        coolingDown = true;
        return Promise.resolve(cooldownError(7));
      }
      return Promise.resolve(
        giftsAnswer(
          [],
          owner,
          "NONE",
          coolingDown ? { hours: 7, rejected: true } : undefined,
        ),
      );
    });
    await mount();

    expect(button("Добавить в друзья")).toBeDefined();
    expect(text()).not.toContain("Отклонено");

    await press("Добавить в друзья");

    expect(inviteCalls()).toBe(1);
    expect(profileReads()).toBe(2);
    expect(text()).toContain("Можно снова через 7 ч");
    expect(text()).toContain("Отклонено");
    expect(text()).not.toContain("Слишком много попыток");
    expect(button("Добавить в друзья")).toBeUndefined();
    const toast = container.querySelector('[data-testid="toast-host"]');
    expect(toast?.textContent).toContain("Можно снова через 7 ч");
  });

  it("устаревшее «нет связи» у отклонившего: кнопка выключена, часы без «Отклонено»", async () => {
    let coolingDown = false;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") {
        coolingDown = true;
        return Promise.resolve(cooldownError(24));
      }
      return Promise.resolve(
        giftsAnswer(
          [],
          owner,
          "NONE",
          coolingDown ? { hours: 24, rejected: false } : undefined,
        ),
      );
    });
    await mount();

    await press("Добавить в друзья");

    expect(inviteCalls()).toBe(1);
    expect(profileReads()).toBe(2);
    expect(text()).toContain("Можно снова через 24 ч");
    expect(text()).not.toContain("Отклонено");
    expect(text()).not.toContain("Слишком много попыток");
    const toast = container.querySelector('[data-testid="toast-host"]');
    expect(toast?.textContent).toContain("Можно снова через 24 ч");
    const add = button("Добавить в друзья");
    expect(add).toBeDefined();
    expect(add?.getAttribute("aria-disabled")).toBe("true");
  });

  it("другой RATE_LIMITED остаётся общим текстом, без перечитывания и без часов", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") {
        return Promise.resolve({
          ok: false,
          code: "RATE_LIMITED",
          message: "",
          params: { unit: "minute", count: 1 },
        });
      }
      return Promise.resolve(giftsAnswer([]));
    });
    await mount();

    await press("Добавить в друзья");

    expect(inviteCalls()).toBe(1);
    expect(profileReads()).toBe(1);
    expect(text()).toContain("Слишком много попыток");
    expect(text()).not.toContain("Можно снова через");
    expect(button("Добавить в друзья")).toBeDefined();
  });

  it.each([undefined, 0, 2.5, "7"])(
    "INVITE_COOLDOWN с непригодными часами (%s) даёт общий текст и всё равно перечитывает профиль",
    async (hours) => {
      api.apiRequest.mockImplementation((path: string) => {
        if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
        if (path === "/api/v1/u/boris/invite") {
          return Promise.resolve(cooldownError(hours));
        }
        return Promise.resolve(giftsAnswer([]));
      });
      await mount();

      await press("Добавить в друзья");

      expect(inviteCalls()).toBe(1);
      expect(profileReads()).toBe(2);
      expect(text()).toContain("Слишком много попыток");
      expect(text()).not.toContain("Можно снова через");
      expect(button("Добавить в друзья")).toBeDefined();
    },
  );
});

/**
 * Story 4.6: the subscription switch reads one profile-only fact and writes one
 * directed edge. The friend action and the subscription never cancel each
 * other, and a repeat success is not an error.
 */
describe("профиль: подписка (Story 4.6)", () => {
  it("нет подписки: «Подписаться» шлёт POST, сразу меняет на «Отписаться» и говорит тост", async () => {
    let resolveSubscribe: (value: unknown) => void = () => {};
    let subscribed = false;
    const subscribe = new Promise((resolve) => {
      resolveSubscribe = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/subscription") return subscribe;
      return Promise.resolve(giftsAnswer(subscribed ? [gift()] : [], owner, "NONE", undefined, subscribed));
    });
    await mount();

    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();

    await press("Подписаться");

    expect(subscriptionCalls("POST")).toBe(1);
    expect(button("Отписаться")).toBeDefined();
    expect(button("Подписаться")).toBeUndefined();
    expect(profileReads()).toBe(1);
    expect(text()).not.toContain("Наушники");

    subscribed = true;
    await act(async () => resolveSubscribe(subscriptionAnswer("SUBSCRIBED")));
    await settle(10);

    expect(text()).toContain("Вы подписались");
    expect(text()).toContain("Наушники");
    expect(button("Отписаться")).toBeDefined();
    expect(profileReads()).toBe(2);
  });

  it("уже подписан: «Отписаться» шлёт DELETE и возвращает «Подписаться»", async () => {
    let subscribed = true;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/subscription") {
        subscribed = false;
        return Promise.resolve(subscriptionAnswer("UNSUBSCRIBED"));
      }
      return Promise.resolve(giftsAnswer(subscribed ? [gift()] : [], owner, "NONE", undefined, subscribed));
    });
    await mount();

    expect(button("Отписаться")).toBeDefined();
    expect(button("Подписаться")).toBeUndefined();
    expect(text()).toContain("Наушники");

    await press("Отписаться");

    expect(subscriptionCalls("DELETE")).toBe(1);
    expect(subscriptionCalls("POST")).toBe(0);
    expect(text()).toContain("Вы отписались");
    expect(text()).not.toContain("Наушники");
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(profileReads()).toBe(2);
  });

  it("повторная подписка — успешный no-op, без ошибки и с тем же тостом", async () => {
    let subscribed = false;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/subscription") {
        subscribed = true;
        return Promise.resolve(subscriptionAnswer("ALREADY_SUBSCRIBED"));
      }
      return Promise.resolve(giftsAnswer([], owner, "NONE", undefined, subscribed));
    });
    await mount();

    await press("Подписаться");

    expect(text()).toContain("Вы подписались");
    expect(text()).not.toContain("Нет доступа");
    expect(text()).not.toContain("Не получилось");
    expect(button("Отписаться")).toBeDefined();
  });

  it("повторная отписка — успешный no-op, без ошибки", async () => {
    let subscribed = true;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/subscription") {
        subscribed = false;
        return Promise.resolve(subscriptionAnswer("NOT_SUBSCRIBED"));
      }
      return Promise.resolve(giftsAnswer([], owner, "NONE", undefined, subscribed));
    });
    await mount();

    await press("Отписаться");

    expect(text()).toContain("Вы отписались");
    expect(text()).not.toContain("Нет доступа");
    expect(button("Подписаться")).toBeDefined();
  });

  it("FORBIDDEN: тост «Нет доступа», подписка откатывается", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/subscription") {
        return Promise.resolve({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
      }
      return Promise.resolve(giftsAnswer([]));
    });
    await mount();

    await press("Подписаться");

    expect(text()).toContain("Нет доступа.");
    expect(text()).not.toContain("Вы подписались");
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
  });

  it("сеть: подписка откатывается, кнопка возвращается, тост остаётся", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/subscription") {
        return Promise.resolve({ ok: false, network: true });
      }
      return Promise.resolve(giftsAnswer([]));
    });
    await mount();

    await press("Подписаться");

    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(text()).not.toContain("Вы подписались");
    expect(button("Подписаться")).toBeDefined();
    expect(button("Отписаться")).toBeUndefined();
  });

  it("401 при подписке уводит на вход с прежним безопасным next", async () => {
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/subscription") {
        return Promise.resolve({ ok: false, code: "UNAUTHENTICATED", message: "" });
      }
      if (path === "/api/v1/session") {
        return Promise.resolve({ ok: true, data: { signedOut: true } });
      }
      return Promise.resolve(giftsAnswer([]));
    });
    await mount();

    await press("Подписаться");

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/u/boris", reason: "session_expired" },
    });
  });

  it("подписка и дружба не отменяют друг друга: ответ приглашения не теряется", async () => {
    let resolveInvite: (value: unknown) => void = () => {};
    let inviteSent = false;
    let subscribed = false;
    const invite = new Promise((resolve) => {
      resolveInvite = resolve;
    });
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") return invite;
      if (path === "/api/v1/u/boris/subscription") {
        subscribed = true;
        return Promise.resolve(subscriptionAnswer("SUBSCRIBED"));
      }
      return Promise.resolve(
        giftsAnswer(subscribed ? [gift()] : [], owner, inviteSent ? "OUTGOING_PENDING" : "NONE", undefined, subscribed),
      );
    });
    await mount();

    await press("Добавить в друзья");
    expect(text()).toContain("Ожидает ответа");

    await press("Подписаться");
    expect(text()).toContain("Вы подписались");
    expect(text()).toContain("Ожидает ответа");
    expect(profileReads()).toBe(1);

    inviteSent = true;
    await act(async () => resolveInvite(inviteAnswer("INVITED")));
    await settle(10);

    expect(text()).toContain("Приглашение отправлено");
    expect(text()).toContain("Ожидает ответа");
    expect(text()).toContain("Наушники");
    expect(button("Отписаться")).toBeDefined();
    expect(profileReads()).toBe(2);
  });

  it("ответ профиля до NOT_FOUND от заявки не возвращает устаревшие желания", async () => {
    let resolveRead: (value: unknown) => void = () => {};
    const refresh = new Promise((resolve) => {
      resolveRead = resolve;
    });
    let subscribed = false;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/u/boris/invite") return Promise.resolve(notFoundAnswer());
      if (path === "/api/v1/u/boris/subscription") {
        subscribed = true;
        return Promise.resolve(subscriptionAnswer("SUBSCRIBED"));
      }
      return subscribed ? refresh : Promise.resolve(giftsAnswer([]));
    });
    await mount();
    await press("Подписаться");
    expect(profileReads()).toBe(2);

    await press("Добавить в друзья");
    await act(async () => resolveRead(giftsAnswer([gift()], owner, "NONE", undefined, true)));
    await settle(10);

    expect(text()).toContain("Пользователь не найден.");
    expect(text()).not.toContain("Наушники");
  });
});

/**
 * W12.20: the profile screen lays itself out with the Tamagui media clause
 * `$page-gutter medium:$page-gutter-lg` instead of `useWindowDimensions` +
 * `pageGutter(width)`. The window width is still read for the card grid alone: the
 * card width of `cardGrid` is grid maths, not a CSS breakpoint
 * (`sprint-change-proposal-2026-11-10-ui-polish.md:323`), and the loading skeleton
 * of the profile follows the same grid.
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
describe("W12.20: экран профиля на медиа-пропсах", () => {
  /** Four wishes, as the coordinator's mock: three statuses, one tag, `relationship: NONE`. */
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
      visibility: "FRIENDS",
      status: "RESERVED",
      reservedBy: { id: "u2", nick: "oleg", displayName: "Олег" },
    }),
    gift({
      id: "g3",
      title: "Книга",
      priceAmount: null,
      priceCurrency: null,
      visibility: "SECRET",
      status: "CLOSED",
      reservationLabel: "GIVEN",
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
      join(dirname(fileURLToPath(import.meta.url)), "../../app/(app)/u/[nick].tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/\bpageGutter\b/);
  });

  it("экран отрисован: имя владельца, сетка из трёх желаний, «Уже подарено» и подвал", async () => {
    await mountAt(1024);

    expect(container.querySelector('[data-testid="profile-page"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="profile-owner"]')?.textContent).toContain(
      "Борис",
    );
    expect(container.querySelector('[role="heading"][aria-level="1"]')?.textContent).toBe(
      "Борис",
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

    expect(body, "контент профиля").toBeDefined();
    expect(paintedValue(body as Element, "padding-top", 360)).toBe("var(--t-space-2)");
    expect(paintedSpace(body as Element, "padding-top", 360)).toBe(spacing["grid-gap"] / 2);
    expect(paintedSpace(body as Element, "padding-bottom", 360)).toBe(spacing["section-gap"]);
    expect(paintedSpace(body as Element, "gap", 360)).toBe(spacing["grid-gap"]);
  });

  /**
   * CLE-129, T4.4 (D-63): a wish card of somebody else's profile is a real link
   * to the wish page; the profile has no list token, and no dialog opens.
   */
  it("карточка желания ведёт на страницу /gifts/{id} без токена списка", async () => {
    await mountAt(1024);

    const card = container.querySelector<HTMLElement>(
      '[role="list"] [role="listitem"] [role="link"]',
    );
    expect(card, "ссылка карточки").not.toBeNull();
    expect(card?.getAttribute("aria-label")).toContain("Наушники");

    await act(async () => {
      card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();

    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/gifts/[id]",
      params: { id: "g1", title: "Наушники" },
    });
    expect(dialogElement()).toBeNull();
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
 * Story 5.3 (SECTION_VIEWER): у зрителя закрытые желания профиля лежат в свёрнутой
 * секции «Уже подарено» без действий. `/u/:nick` отдаёт карточки зрителя, ключа
 * `undoUntil` в них нет, поэтому окно отмены и его кнопки живут только на «Мой
 * вишлист».
 */
describe("профиль: закрытые желания", () => {
  const closed = gift({
    id: "g-closed",
    title: "Свитер",
    status: "CLOSED",
  });

  it("«Уже подарено» свёрнута, карточка закрытого появляется только после нажатия", async () => {
    respond(giftsAnswer([closed]));
    await mount();

    expect(text()).toContain("Уже подарено");
    expect(container.querySelector('[data-testid="profile-closed-toggle"]')?.getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(text()).not.toContain("Свитер");

    await press("Уже подарено");
    const section = container.querySelector('[data-testid="profile-closed"]');
    expect(section?.textContent).toContain("Свитер");
    expect(text()).not.toContain("Вернуть в открытые");
    expect(text()).not.toContain("Хочу ещё такой");
  });
});
