// @vitest-environment happy-dom
import { formatDate, formatPrice, type GiftCard } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import MyWishlistScreen from "../../app/(app)/index";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

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

  /** `app.gift.status` resolves the same way `useTranslations` prefixes a namespace. */
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
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  type Props = { children?: React.ReactNode; testID?: string };
  const element = (tag: string) =>
    function Element({ children, testID }: Props) {
      return React.createElement(tag, testID ? { "data-testid": testID } : null, children);
    };
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    Text: element("span"),
    View: element("div"),
    ScrollView: element("div"),
    // One column, like a phone in the browser (DESIGN.md → columns).
    useWindowDimensions: () => ({ width: 375, height: 800 }),
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
    }: Props & { onPress?: () => void; accessibilityLabel?: string }) =>
      React.createElement(
        "button",
        { type: "button", "aria-label": accessibilityLabel, onClick: onPress },
        children,
      ),
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

const user = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
};

function gift(overrides: Partial<GiftCard> = {}): GiftCard {
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

/** `/api/v1/me` answers with the session; every other path answers with the wishlist. */
function respond(gifts: unknown, session: unknown = { ok: true, data: user }) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(path === "/api/v1/me" ? session : gifts),
  );
}

function giftsAnswer(cards: unknown[]) {
  return { ok: true, data: { access: "gifts", gifts: cards } };
}

let root: Root;
let container: HTMLElement;

function text(): string {
  return container.textContent ?? "";
}

/**
 * The Story 1.1 smoke screen must not come back (kept from the deleted
 * `home-screen.test.tsx`). «желание» itself is not checked: the empty state
 * legitimately uses the word.
 */
function expectNoSmoke() {
  expect(text()).not.toContain("Контракт на месте");
  expect(text()).not.toContain("задан");
  expect(text()).not.toContain("Войти");
  expect(text()).not.toContain("Регистрация");
  expect(text()).not.toContain("Алёна");
  expect(text()).not.toContain(formatDate("2026-10-31", "ru"));
  expect(text()).not.toContain(formatPrice(1050, "BYN", "ru"));
  expect(text()).not.toContain(formatPrice(250000, "RUB", "ru"));
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((node) =>
    (node.textContent ?? "").includes(label),
  );
}

async function press(label: string) {
  const target = button(label);
  expect(target).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <MyWishlistScreen />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("мой вишлист: гейт сессии", () => {
  it("пока сессия неизвестна, ничего не показывает и не уходит со страницы", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toBe("");
  });

  it("аноним с / уходит на вход с возвратом на главную", async () => {
    respond(null, { ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/" },
    });
    expect(text()).not.toContain("Мой вишлист");
    expectNoSmoke();
  });

  it("обрыв сети при проверке сессии тоже уводит на вход", async () => {
    respond(null, { ok: false, network: true });
    await mount();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/" },
    });
  });

  it("сессия истекла при загрузке желаний — вход с возвратом на главную и причиной", async () => {
    respond({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/", reason: "session_expired" },
    });
  });

  it("сессия истекла при загрузке желаний — toast уходит на экран входа, не остаётся здесь", async () => {
    respond({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();
    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/", reason: "session_expired" },
    });
    expect(text()).not.toContain("Сессия закончилась, войдите снова");
  });
});

describe("мой вишлист: список", () => {
  it("шапка, заголовок и «Написать автору» на месте, без smoke", async () => {
    respond(giftsAnswer([]));
    await mount();

    expect(text()).toContain("Gift List");
    expect(text()).toContain("Мой вишлист");
    expect(text()).toContain("Написать автору");
    expectNoSmoke();
  });

  it("пока грузится, показывает skeleton без карточек и пустого состояния", async () => {
    respond(new Promise(() => {}));
    await mount();
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(3);
    expect(text()).not.toContain("Пока пусто");
    expect(button("Добавить желание")).toBeUndefined();
  });

  it("показывает все свои желания, включая «секрет», с чипом видимости и статусом", async () => {
    respond(
      giftsAnswer([
        gift(),
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
        }),
      ]),
    );
    await mount();

    expect(text()).toContain("Наушники");
    expect(text()).toContain(formatPrice(250000, "RUB", "ru"));
    expect(text()).toContain("Свитер");
    expect(text()).toContain(formatPrice(1050, "BYN", "ru"));
    expect(text()).toContain("Книга");
    expect(text()).toContain("Всем");
    expect(text()).toContain("Друзьям");
    expect(text()).toContain("Секрет");
    expect(text()).toContain("Открыт");
    expect(text()).toContain("Забронирован");
    expect(text()).toContain("Получен");
    expect(text()).toContain("Берёт Олег");
    expect(text()).not.toContain("Пока пусто");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(0);
  });

  it("пустой вишлист: «Пока пусто» и «Добавить желание» ведёт в форму", async () => {
    respond(giftsAnswer([]));
    await mount();

    expect(text()).toContain("Пока пусто");
    expect(text()).toContain("Добавьте первое желание — название и, по желанию, цену-ориентир.");
    await press("Добавить желание");
    expect(navigation.push).toHaveBeenCalledWith("/gifts/new");
  });

  it("ошибка сети — toast с повтором; после «Закрыть» toast уходит", async () => {
    respond({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();

    await press("Закрыть");
    expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(button("Повторить")).toBeDefined();
  });

  it("ошибка действия тоже показывается строкой каталога, а не молчит", async () => {
    respond({ ok: false, code: "FORBIDDEN", message: "" });
    await mount();

    expect(text()).toContain("Нет доступа.");
    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
  });

  it("«Повторить» перезагружает список и показывает карточки", async () => {
    respond({ ok: false, network: true });
    await mount();
    expect(text()).not.toContain("Наушники");

    respond(giftsAnswer([gift()]));
    await press("Повторить");

    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
  });

  it("ответ не по контракту не рисуется и даёт тот же toast", async () => {
    respond(giftsAnswer([{ ...gift(), bought: true }]));
    await mount();

    expect(text()).not.toContain("Наушники");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("«Выйти» при обрыве сети оставляет человека на экране и показывает toast", async () => {
    respond(giftsAnswer([]));
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/session" ? { ok: false, network: true } : giftsAnswer([]),
      ),
    );
    await press("Выйти");

    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toContain("Мой вишлист");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("«Выйти» при живой сессии открывает вход", async () => {
    respond(giftsAnswer([]));
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/session" ? { ok: true, data: { signedOut: true } } : user,
      ),
    );
    await press("Выйти");

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/" },
    });
    expect(text()).not.toContain("Мой вишлист");
  });

  it("«Выйти» при уже погашенной сессии всё равно открывает вход", async () => {
    respond(giftsAnswer([]));
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/session"
          ? { ok: false, code: "UNAUTHENTICATED", message: "" }
          : path === "/api/v1/me"
            ? { ok: true, data: user }
            : giftsAnswer([]),
      ),
    );
    await press("Выйти");

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/" },
    });
  });
});
