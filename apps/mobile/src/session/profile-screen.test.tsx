// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, settle } from "@/test/dom";
import ProfileScreen from "../../app/u/[nick]";

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

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => store);
vi.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "ru-RU" }],
}));
vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    router: navigation,
    Stack: { Screen: () => null },
    Link: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
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
) {
  return {
    ok: true,
    data: {
      access: "gifts",
      gifts: cards,
      ...(ownerBlock === undefined ? {} : { owner: ownerBlock }),
      ...(relationship === undefined ? {} : { relationship }),
      ...(inviteCooldown === undefined ? {} : { inviteCooldown }),
    },
  };
}

function inviteAnswer(outcome: string) {
  return { ok: true, data: { outcome } };
}

function notFoundAnswer() {
  return { ok: true, data: { access: "not_found", gifts: [] } };
}

/** `/api/v1/me` answers with the session; every other path answers with the profile. */
function respond(profile: unknown, session: unknown = { ok: true, data: user }) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(path === "/api/v1/me" ? session : profile),
  );
}

function profileReads(): number {
  return api.apiRequest.mock.calls.filter(
    ([path]) => String(path).startsWith("/api/v1/u/") && !String(path).includes("/invite"),
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
  search.params = { nick: "boris" };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
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

  it("при «нет связи» рисует только «Добавить в друзья», без подписки и блока", async () => {
    respond(giftsAnswer([]));
    await mount();

    expect(button("Добавить в друзья")).toBeDefined();
    expect(button("Принять приглашение")).toBeUndefined();
    expect(button("Подписаться")).toBeUndefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(button("Заблокировать")).toBeUndefined();
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

describe("профиль: принятие и отказ (Story 4.2.3)", () => {
  it("входящий pending: рядом «Принять приглашение» и «Отклонить», без подписки и блока", async () => {
    respond(giftsAnswer([], owner, "INCOMING_PENDING"));
    await mount();

    expect(text()).toContain("Зовёт в друзья");
    expect(button("Принять приглашение")).toBeDefined();
    expect(button("Отклонить")).toBeDefined();
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Подписаться")).toBeUndefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(button("Заблокировать")).toBeUndefined();
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
            )
          : giftsAnswer([], owner, "INCOMING_PENDING"),
      );
    });
    await mount();

    await press("Принять приглашение");

    expect(actionCalls("accept")).toBe(1);
    expect(profileReads()).toBe(2);
    expect(text()).toContain("Друзья");
    expect(text()).toContain("Наушники");
    expect(text()).toContain("Свитер");
    expect(text()).not.toContain("Зовёт в друзья");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Отклонить")).toBeUndefined();
  });

  it("свой профиль: ни принятия, ни отказа, ни cooldown", async () => {
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
    expect(button("Подписаться")).toBeUndefined();
    expect(button("Отписаться")).toBeUndefined();
    expect(button("Заблокировать")).toBeUndefined();
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
    expectNoForeignActions();
  });

  it("исходящий pending: только «Ожидает ответа», без второй отправки и отмены", async () => {
    respond(giftsAnswer([], owner, "OUTGOING_PENDING"));
    await mount();

    expect(text()).toContain("Ожидает ответа");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
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
    expectNoForeignActions();
  });

  it("уже друзья: только chip «Друзья» и никаких действий", async () => {
    respond(giftsAnswer([], owner, "FRIENDS"));
    await mount();

    expect(text()).toContain("Друзья");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
    expectNoForeignActions();
  });

  it("свой профиль: chip «Это вы» и никаких действий", async () => {
    search.params = { nick: "anya" };
    respond(giftsAnswer([], { displayName: "Аня", nick: "anya" }, "NONE"));
    await mount();

    expect(text()).toContain("Это вы");
    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Принять приглашение")).toBeUndefined();
    expectNoForeignActions();
  });

  it("not_found: «Пользователь не найден.» без кнопки", async () => {
    respond(notFoundAnswer());
    await mount();

    expect(text()).toContain("Пользователь не найден.");
    expect(button("Добавить в друзья")).toBeUndefined();
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
