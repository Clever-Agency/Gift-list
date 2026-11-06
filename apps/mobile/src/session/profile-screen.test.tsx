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
vi.mock("expo-router", () => ({
  router: navigation,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => search.params,
}));
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
  return { ok: true, data: { access: "not_found", gifts: [] } };
}

/** `/api/v1/me` answers with the session; every other path answers with the profile. */
function respond(profile: unknown, session: unknown = { ok: true, data: user }) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(path === "/api/v1/me" ? session : profile),
  );
}

function profileReads(): number {
  return api.apiRequest.mock.calls.filter(([path]) =>
    String(path).startsWith("/api/v1/u/"),
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
    "небезопасный сегмент %s не уводит на вход, не запрашивает API и даёт «Пользователь не найден»",
    async (nick) => {
      search.params = { nick };
      respond(giftsAnswer([gift()]));
      await mount();

      expect(navigation.replace).not.toHaveBeenCalled();
      expect(profileReads()).toBe(0);
      expect(text()).toContain("Пользователь не найден");
    },
  );

  it("пока сессия неизвестна, профиль не запрашивается", async () => {
    api.apiRequest.mockImplementation((path: string) =>
      path === "/api/v1/me" ? new Promise(() => {}) : Promise.resolve(giftsAnswer([])),
    );
    await mount();

    expect(profileReads()).toBe(0);
    expect(navigation.replace).not.toHaveBeenCalled();
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

  it("не рисует кнопок дружбы, подписки и блока (Epic 4)", async () => {
    respond(giftsAnswer([]));
    await mount();

    expect(button("Добавить в друзья")).toBeUndefined();
    expect(button("Подписаться")).toBeUndefined();
    expect(button("Заблокировать")).toBeUndefined();
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

    const region = container.querySelector('[aria-label="Загружаем профиль"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
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
