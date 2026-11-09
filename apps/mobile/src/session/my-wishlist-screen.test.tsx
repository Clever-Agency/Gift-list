// @vitest-environment happy-dom
import { formatDate, formatPrice, type GiftCard } from "@gift-list/contracts";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/session/auth-context";
import { controls, dialogElement, pressScrim, settle } from "@/test/dom";
import MyWishlistScreen from "../../app/(app)/index";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const clipboard = vi.hoisted(() => ({ copyText: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  setParams: vi.fn(),
}));
/**
 * Search params stand-in: the create screen hands its «Добавлено в вишлист» notice
 * over in `?toast=`, and `setParams` is where the list drops it again.
 */
const search = vi.hoisted(() => ({ params: {} as Record<string, string | undefined> }));

/**
 * `useFocusEffect` stand-in: expo-router runs the callback while the screen is focused
 * and its cleanup when it blurs. `blur()`/`refocus()` walk the screen through that,
 * like a back navigation from `/gifts/new` would.
 */
const focusStore = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    focused: true,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => focusStore.focused,
    set: (next: boolean) => {
      focusStore.focused = next;
      for (const listener of listeners) listener();
    },
    reset: () => {
      listeners.clear();
      focusStore.focused = true;
    },
  };
});

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/platform/clipboard", () => clipboard);
vi.mock("@/session/device-time-zone", () => zone);
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
// The visibility chip draws its icon with `expo-symbols`, which loads a symbol font
// at runtime; the icon is decorative, so a stub is enough on the wishlist screen.
vi.mock("expo-symbols", async () => {
  const React = await import("react");
  return {
    SymbolView: () => React.createElement("span", { "data-testid": "visibility-icon" }),
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
vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    router: navigation,
    Stack: { Screen: () => null },
    useLocalSearchParams: () => search.params,
    useFocusEffect: (effect: () => void | (() => void)) => {
      const focused = React.useSyncExternalStore(
        focusStore.subscribe,
        focusStore.snapshot,
        focusStore.snapshot,
      );
      React.useEffect(() => {
        if (!focused) return undefined;
        // Like expo-router: re-runs when the callback identity changes, cleans up on blur.
        return effect();
      }, [effect, focused]);
    },
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
    // Review m7: the grid subtracts these from the window width; the browser mock
    // has no notch, so the grid maths falls back to the plain window.
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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

function giftsAnswer(cards: unknown[], publicToken?: string) {
  return {
    ok: true,
    data:
      publicToken === undefined
        ? { access: "gifts", gifts: cards }
        : { access: "gifts", gifts: cards, publicToken },
  };
}

let root: Root;
let container: HTMLElement;

/** Everything on screen, layers included: a `Dialog` is portalled outside the container. */
function text(): string {
  return document.body.textContent ?? "";
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

function button(label: string): HTMLElement | undefined {
  return controls(document).find((node) =>
    (node.textContent ?? "").includes(label),
  );
}

async function press(label: string) {
  const target = button(label);
  expect(target).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/** The icon-only «Что видно по ссылке» control next to the copy button. */
function infoTrigger(): HTMLElement | null {
  return container.querySelector('[data-testid="wishlist-copy-link-info"]');
}

/** Opens the web tooltip with the keyboard, not with a mouse hover. */
async function openInfoByKeyboard() {
  const trigger = infoTrigger();
  expect(trigger).not.toBeNull();
  await act(async () => {
    trigger?.focus();
  });
  await settle(10);
  return trigger as HTMLElement;
}

/** Opens the web tooltip by a tap/click, the touch path. */
async function openInfoByPress() {
  const trigger = infoTrigger();
  expect(trigger).not.toBeNull();
  await act(async () => {
    trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
  return trigger as HTMLElement;
}

/** Leaves the screen for another route (the composer), as a push would. */
async function blur() {
  await act(async () => {
    focusStore.set(false);
  });
}

/** Comes back to the screen, as a back navigation from the composer would. */
async function refocus() {
  await act(async () => {
    focusStore.set(true);
  });
}

/** Every read of the owner list, so a refocus refetch is countable. */
function listReads(): number {
  return api.apiRequest.mock.calls.filter(([path]) => path === "/api/v1/me/gifts").length;
}

/**
 * The visibility chip is a button only on an open wish; its accessible name starts
 * with `app.gift.visibilityChipLabel` and the visible word is the chip value.
 */
function chip(value: string): HTMLElement | undefined {
  return controls(document).find(
    (node) =>
      (node.getAttribute("aria-label") ?? "").startsWith("Видимость:") &&
      (node.textContent ?? "").includes(value),
  );
}

/** The PATCH calls to the first wish, so an optimistic save is countable. */
function patchCalls(): unknown[][] {
  return api.apiRequest.mock.calls.filter(
    ([path, init]) =>
      path === "/api/v1/me/gifts/g1" &&
      typeof init === "object" &&
      init !== null &&
      (init as { method?: string }).method === "PATCH",
  );
}

async function chooseInDialog(label: string) {
  const option = document.querySelector<HTMLElement>(`[role="radio"][aria-label="${label}"]`);
  expect(option).not.toBeNull();
  await act(async () => {
    option?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

async function mount(extra?: ReactNode) {
  await act(async () => {
    root.render(
      <AuthProvider>
        <MyWishlistScreen />
        {extra}
      </AuthProvider>,
    );
  });
}

/**
 * Story 3.1 changes the session nick without leaving the screen. The share link is
 * built only from `List.publicToken`, so the next copy must be byte-for-byte the
 * same URL (A-26).
 */
function NickSwitcher() {
  const auth = useAuth();

  function changeNick() {
    if (auth.state.status !== "ready") return;
    auth.setUser({ ...auth.state.user, nick: "newnick" });
  }

  return (
    <button type="button" onClick={changeNick}>
      Сменить ник
    </button>
  );
}

NickSwitcher.displayName = "NickSwitcher";

beforeEach(() => {
  vi.resetAllMocks();
  // Story 2.4: the clipboard write succeeds unless a test says otherwise.
  clipboard.copyText.mockResolvedValue(true);
  focusStore.reset();
  search.params = {};
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
});

describe("мой вишлист: гейт сессии", () => {
  it("пока сессия неизвестна, показывает общий экран загрузки и не уходит со страницы", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();
    expect(navigation.replace).not.toHaveBeenCalled();
    const region = container.querySelector('[data-testid="session-loading"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(3);
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

describe("мой вишлист: каркас страницы", () => {
  it("одна прокрутка на всю страницу: заголовок и подвал внутри неё", async () => {
    respond(giftsAnswer([]));
    await mount();

    const page = container.querySelector('[data-testid="wishlist-page"]');
    expect(page).not.toBeNull();
    expect(getComputedStyle(page as Element).overflowY).toBe("auto");
    expect(page?.textContent).toContain("Мой вишлист");
    expect(page?.querySelector('[data-testid="wishlist-footer"]')).not.toBeNull();

    const scrollers = Array.from(container.querySelectorAll("*")).filter((node) =>
      ["auto", "scroll"].includes(getComputedStyle(node).overflowY),
    );
    expect(scrollers).toEqual([page]);
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

  /**
   * `EXPERIENCE.md` → State Patterns → «Загрузка»: the skeleton is one busy region
   * with a name, not three anonymous boxes for a screen reader.
   */
  it("skeleton объявлен диктору: одна занятая область с подписью «Загружаем вишлист»", async () => {
    respond(new Promise(() => {}));
    await mount();

    const region = container.querySelector('[data-testid="my-wishlist-loading"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("status");
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем вишлист");
    expect(region?.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(3);
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
          // ACTIVE phase (no ownerAction) with the holder name shared (FR-31).
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

  /**
   * Review m5. Reviewers flagged the gift grid as a bare `View` tree: screen
   * readers got no list semantics at all. The container is `role="list"` and every
   * card wrapper is `role="listitem"` — RN's DOM role alias, which
   * react-native-web forwards and native maps to the closest accessibility trait.
   */
  it("сетка карточек размечена как список: role list у сетки, role listitem у карточек", async () => {
    respond(giftsAnswer([gift(), gift({ id: "g2", title: "Свитер" })]));
    await mount();

    const list = container.querySelector('[role="list"]');
    expect(list).not.toBeNull();
    const items = list?.querySelectorAll('[role="listitem"]') ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("Наушники");
    expect(items[1]?.textContent).toContain("Свитер");
  });

  /**
   * Story 2.2: the owner card is the way into the edit form. The pressable lives
   * inside the listitem, so the list semantics above stay exactly as they were.
   * CLE-65: the press zone is the whole card, and the chip is a sibling layer over
   * the reserved footer, not a nested button.
   */
  it("нажатие на карточку открывает редактирование желания, listitem остаётся", async () => {
    respond(giftsAnswer([gift(), gift({ id: "g2", title: "Свитер" })]));
    await mount();

    const items = container.querySelectorAll('[role="list"] [role="listitem"]');
    expect(items).toHaveLength(2);

    // The label is the `DESIGN.md` content phrase; the mock renders Pressable as a button.
    const card = items[0]?.querySelector('[role="button"]') as HTMLElement | null;
    expect(card?.getAttribute("aria-label")).toContain("Наушники");
    expect(card?.getAttribute("aria-label")).not.toContain("Изменить");
    // The chip sits next to the card button, never inside it; its layer is
    // transparent to presses outside the chip.
    expect(chip("Всем")).toBeDefined();
    expect(card?.contains(chip("Всем") ?? null)).toBe(false);
    // `box-none`: the layer itself lets presses through to the card button underneath.
    const chipLayer = chip("Всем")?.parentElement as HTMLElement;
    expect(getComputedStyle(chipLayer).pointerEvents).toBe("none");
    await act(async () => {
      card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/gifts/[id]/edit",
      params: { id: "g1" },
    });
  });

  /**
   * CLE-65 reproduction: a click on the empty footer space next to the «Всем» chip
   * did nothing. That space is the card's reserved footer spacer — the last box of
   * the card button — so the press now opens the editor.
   */
  it("нажатие на пустое место рядом с чипом открывает редактирование", async () => {
    respond(giftsAnswer([gift()]));
    await mount();

    const card = container.querySelector(
      '[role="listitem"] > [role="button"]',
    ) as HTMLElement | null;
    expect(card?.getAttribute("aria-label")).toContain("Наушники");
    const spacer = card?.lastElementChild as HTMLElement | null;
    expect(spacer).not.toBeNull();
    expect(spacer?.getAttribute("aria-label")).toBeNull();
    await act(async () => {
      spacer?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/gifts/[id]/edit",
      params: { id: "g1" },
    });
  });

  it("пустой вишлист: «Пока пусто» и «Добавить желание» ведёт в форму", async () => {
    respond(giftsAnswer([]));
    await mount();

    expect(text()).toContain("Пока пусто");
    expect(text()).toContain("Добавьте первое желание — название и, по желанию, цену-ориентир.");
    // Review N4: подборки вне объёма, поэтому в пустом состоянии нет ghost-кнопки —
    // одна основная CTA (`DESIGN.md` → EmptyState: не больше одной кнопки).
    expect(button("Посмотреть подборки")).toBeUndefined();
    expect(text()).not.toContain("Посмотреть подборки");
    await press("Добавить желание");
    expect(navigation.push).toHaveBeenCalledWith("/gifts/new");
  });

  /**
   * `EXPERIENCE.md` → State Patterns → «Список не найден»: a closed gate is not an
   * empty wishlist, so the empty-state texts and the composer CTA must not appear.
   */
  it("закрытый гейт списка: «Список не найден», а не пустой вишлист", async () => {
    respond({ ok: true, data: { access: "not_found", gifts: [] } });
    await mount();

    expect(text()).toContain("Список не найден.");
    expect(text()).not.toContain("Пока пусто");
    expect(text()).not.toContain("Добавьте первое желание");
    expect(button("Добавить желание")).toBeUndefined();
    expect(button("Повторить")).toBeDefined();
  });

  it("ошибка NOT_FOUND тоже даёт «Список не найден», а не пустой вишлист", async () => {
    respond({ ok: false, code: "NOT_FOUND", message: "" });
    await mount();

    expect(text()).toContain("Список не найден.");
    expect(text()).not.toContain("Пока пусто");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
  });

  it("«Повторить» из «Список не найден» перезагружает список", async () => {
    respond({ ok: true, data: { access: "not_found", gifts: [] } });
    await mount();

    respond(giftsAnswer([gift()]));
    await press("Повторить");

    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Список не найден.");
  });

  it("ошибка сети — сетевой текст тела и toast с повтором; после «Закрыть» toast уходит", async () => {
    respond({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).not.toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();

    await press("Закрыть");
    expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(button("Повторить")).toBeDefined();
  });

  it("ошибка кода API — общее тело ошибки, а не сетевой текст", async () => {
    respond({ ok: false, code: "FORBIDDEN", message: "" });
    await mount();

    expect(text()).toContain("Нет доступа.");
    expect(text()).toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
    expect(button("Повторить")).toBeDefined();
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

  it("ответ не по контракту не рисуется и даёт общее тело ошибки и общий toast, а не сетевые", async () => {
    respond(giftsAnswer([{ ...gift(), bought: true }]));
    await mount();

    expect(text()).not.toContain("Наушники");
    expect(text()).toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).toContain("Не получилось. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();
    expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
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

  /**
   * Review m4. `pointerEvents` is a View prop: in a style object react-native-web
   * drops it, the full-width overlay then swallows touches meant for the screen.
   * The toast is also lifted above the footer row, so «Выйти» is never covered
   * (`DESIGN.md` → Toast: «снизу, над прилипшей кнопкой»).
   */
  it("toast: pointerEvents — проп, а не стиль, и «Выйти» под toast остаётся нажимаемой", async () => {
    respond({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    const host = container.querySelector('[data-testid="toast-host"]');
    expect(host).not.toBeNull();
    // The touch-through overlay: it takes no presses itself, the toast inside stays tappable.
    const hostStyle = getComputedStyle(host as Element);
    expect(hostStyle.pointerEvents).toBe("none");

    // Geometry: the toast bottom sits at or above the top of the footer row.
    const footerStyle = getComputedStyle(
      container.querySelector('[data-testid="wishlist-footer"]') as Element,
    );
    const logoutStyle = getComputedStyle(
      container.querySelector('[data-testid="wishlist-logout"]') as Element,
    );
    const footerHeight =
      Number.parseFloat(footerStyle.paddingBottom) + Number.parseFloat(logoutStyle.minHeight);
    expect(footerHeight).toBeGreaterThan(0);
    expect(Number.parseFloat(hostStyle.bottom)).toBeGreaterThanOrEqual(footerHeight);

    // And the control still works while the toast is on screen.
    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/session"
          ? { ok: true, data: { signedOut: true } }
          : { ok: false, network: true },
      ),
    );
    await press("Выйти");

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/" },
    });
  });

  /** The footer button goes through the auth context, which owns the session call. */
  it("«Выйти» вызывает signOut контекста: DELETE /api/v1/session", async () => {
    respond(giftsAnswer([]));
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/session" ? { ok: true, data: { signedOut: true } } : giftsAnswer([]),
      ),
    );
    await press("Выйти");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/session", { method: "DELETE" });
    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
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

  /**
   * Story 3.1 creates «Настройки» before Story 6.2 gives them a place in the
   * navigation (Профиль → Настройки), so the wishlist footer carries a temporary
   * entry point.
   */
  it("в подвале есть «Настройки», нажатие открывает /settings", async () => {
    respond(giftsAnswer([]));
    await mount();

    const footer = container.querySelector('[data-testid="wishlist-footer"]');
    const settings = footer?.querySelector('[data-testid="wishlist-settings"]');
    expect(settings?.textContent).toContain("Настройки");

    await act(async () => {
      settings?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(navigation.push).toHaveBeenCalledWith("/settings");
  });
});

/**
 * Story 2.4 (FR-28, AD-6, Q-2): one button copies `{origin}/l/{publicToken}` and
 * a toast says so. A missing origin or token is never copied as a broken string;
 * the press shows the error toast instead. No share-sheet.
 */
describe("мой вишлист: копирование ссылки", () => {
  it("копирует ссылку публичного вишлиста и показывает «Ссылка скопирована»", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(giftsAnswer([gift()], "tok-1"));
    await mount();

    await press("Скопировать ссылку");

    expect(clipboard.copyText).toHaveBeenCalledTimes(1);
    expect(clipboard.copyText).toHaveBeenCalledWith("https://gift.example/l/tok-1");
    expect(text()).toContain("Ссылка скопирована");
    expect(text()).not.toContain("Не получилось скопировать ссылку.");
  });

  it("в пустом вишлисте ссылка недоступна, ничего не копирует и объясняет почему", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(giftsAnswer([], "tok-1"));
    await mount();

    const copy = button("Скопировать ссылку");
    expect(copy).toBeDefined();
    expect(copy?.getAttribute("aria-disabled")).toBe("true");
    expect(copy?.getAttribute("aria-label")).toBe("Скопировать ссылку");
    expect(copy?.getAttribute("aria-describedby")).toBe("wishlist-copy-link-reason");
    expect(copy?.tabIndex).toBe(0);
    copy?.focus();
    expect(document.activeElement).toBe(copy);
    expect(container.querySelector("#wishlist-copy-link-reason")?.textContent).toContain(
      "Нет желаний, открытых для всех: приватные и архивные не показываются.",
    );
    expect(text()).toContain("Пока пусто");
    expect(infoTrigger()).not.toBeNull();

    await press("Скопировать ссылку");

    expect(clipboard.copyText).not.toHaveBeenCalled();
    expect(text()).not.toContain("Ссылка скопирована");
  });

  it("только приватные и архивные желания: ссылка недоступна и не копируется", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(
      giftsAnswer(
        [
          gift({ id: "g1", visibility: "FRIENDS" }),
          gift({ id: "g2", visibility: "SECRET" }),
          gift({ id: "g3", archivedAt: "2026-10-01T00:00:00.000Z" }),
        ],
        "tok-1",
      ),
    );
    await mount();

    const copy = button("Скопировать ссылку");
    expect(copy?.getAttribute("aria-disabled")).toBe("true");
    await press("Скопировать ссылку");

    expect(clipboard.copyText).not.toHaveBeenCalled();
    expect(text()).not.toContain("Ссылка скопирована");
  });

  it("одно PUBLIC среди приватных включает копирование", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(
      giftsAnswer(
        [
          gift({ id: "g1", visibility: "SECRET" }),
          gift({ id: "g2", visibility: "PUBLIC" }),
        ],
        "tok-1",
      ),
    );
    await mount();

    await press("Скопировать ссылку");

    expect(clipboard.copyText).toHaveBeenCalledWith("https://gift.example/l/tok-1");
    expect(text()).toContain("Ссылка скопирована");
  });

  it("Info открывает то же пояснение при выключенной ссылке и связано через aria-describedby", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(giftsAnswer([], "tok-1"));
    await mount();

    const trigger = await openInfoByKeyboard();

    expect(trigger.getAttribute("aria-label")).toBe("Что видно по ссылке");
    expect(text()).toContain(
      "По ссылке видны только открытые для всех желания. Приватные желания не показываются.",
    );
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy as string)?.textContent).toContain(
      "По ссылке видны только открытые для всех желания. Приватные желания не показываются.",
    );
  });

  it("Info открывает то же пояснение при включённой ссылке", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(giftsAnswer([gift()], "tok-1"));
    await mount();

    expect(button("Скопировать ссылку")?.getAttribute("aria-disabled")).toBe("false");
    await openInfoByPress();

    expect(text()).toContain(
      "По ссылке видны только открытые для всех желания. Приватные желания не показываются.",
    );
  });

  it("PUBLIC без publicToken оставляет ссылку включённой и даёт понятную ошибку", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(giftsAnswer([gift()]));
    await mount();

    expect(button("Скопировать ссылку")?.getAttribute("aria-disabled")).toBe("false");
    await press("Скопировать ссылку");

    expect(clipboard.copyText).not.toHaveBeenCalled();
    expect(text()).toContain("Не получилось скопировать ссылку. Попробуйте ещё раз.");
  });

  it("пока список загружается, кнопки ссылки нет — поделиться нечем", async () => {
    respond(new Promise(() => {}));
    await mount();

    expect(container.querySelector('[data-testid="wishlist-copy-link"]')).toBeNull();
    expect(infoTrigger()).toBeNull();
    expect(clipboard.copyText).not.toHaveBeenCalled();
  });

  it("ошибка загрузки не показывает кнопку ссылки", async () => {
    respond({ ok: false, code: "INTERNAL", message: "" });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(container.querySelector('[data-testid="wishlist-copy-link"]')).toBeNull();
    expect(infoTrigger()).toBeNull();
    expect(clipboard.copyText).not.toHaveBeenCalled();
  });

  it("без настроенного адреса сайта на вебе берёт origin текущей страницы", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(giftsAnswer([gift()], "tok-1"));
    await mount();

    await press("Скопировать ссылку");

    const pageOrigin = window.location.origin.replace(/\/+$/, "");
    expect(pageOrigin).not.toBe("");
    expect(clipboard.copyText).toHaveBeenCalledWith(`${pageOrigin}/l/tok-1`);
    expect(text()).toContain("Ссылка скопирована");
  });

  it("неверный адрес сайта не подменяется и даёт ошибку", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(giftsAnswer([gift()], "tok-1"));
    await mount();

    await press("Скопировать ссылку");

    expect(clipboard.copyText).not.toHaveBeenCalled();
    expect(text()).toContain("Не получилось скопировать ссылку. Попробуйте ещё раз.");
    expect(text()).not.toContain("Ссылка скопирована");
  });

  it("без publicToken ничего не копирует и показывает ошибку", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(giftsAnswer([gift()]));
    await mount();

    await press("Скопировать ссылку");

    expect(clipboard.copyText).not.toHaveBeenCalled();
    expect(text()).toContain("Не получилось скопировать ссылку. Попробуйте ещё раз.");
    expect(text()).not.toContain("Ссылка скопирована");
  });

  it("когда система не дала записать в буфер, показывает ошибку", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    clipboard.copyText.mockResolvedValue(false);
    respond(giftsAnswer([gift()], "tok-1"));
    await mount();

    await press("Скопировать ссылку");

    expect(clipboard.copyText).toHaveBeenCalledWith("https://gift.example/l/tok-1");
    expect(text()).toContain("Не получилось скопировать ссылку. Попробуйте ещё раз.");
    expect(text()).not.toContain("Ссылка скопирована");
  });

  it("когда буфер выбрасывает исключение, тоже показывает ошибку, а не успех", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    clipboard.copyText.mockRejectedValue(new Error("clipboard denied"));
    respond(giftsAnswer([gift()], "tok-1"));
    await mount();

    await press("Скопировать ссылку");

    expect(clipboard.copyText).toHaveBeenCalledWith("https://gift.example/l/tok-1");
    expect(text()).toContain("Не получилось скопировать ссылку. Попробуйте ещё раз.");
    expect(text()).not.toContain("Ссылка скопирована");
  });

  it("смена ника не меняет токен и скопированную ссылку (A-26)", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    respond(giftsAnswer([gift()], "tok-1"));
    await mount(<NickSwitcher />);

    await press("Скопировать ссылку");
    expect(clipboard.copyText).toHaveBeenLastCalledWith("https://gift.example/l/tok-1");

    await press("Сменить ник");
    await press("Скопировать ссылку");

    expect(clipboard.copyText).toHaveBeenCalledTimes(2);
    expect(clipboard.copyText).toHaveBeenLastCalledWith("https://gift.example/l/tok-1");
    expect(text()).toContain("Ссылка скопирована");
  });
});

/**
 * Review m9: a returning screen must show the list as it is now. «Добавить желание»
 * pushes the composer and comes back to this route, so the refetch hangs off focus.
 */
describe("мой вишлист: возврат на экран", () => {
  it("первый показ не запрашивает список дважды", async () => {
    respond(giftsAnswer([gift()]));
    await mount();

    expect(listReads()).toBe(1);
  });

  it("возврат на экран перезапрашивает список", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    expect(listReads()).toBe(1);

    await blur();
    await refocus();

    expect(listReads()).toBe(2);
  });

  it("новые данные после возврата заменяют старые", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    expect(text()).toContain("Наушники");

    await blur();
    respond(giftsAnswer([gift({ id: "g2", title: "Свитер" })]));
    await refocus();

    expect(text()).toContain("Свитер");
    expect(text()).not.toContain("Наушники");
  });

  it("тихое обновление не показывает skeleton: карточки остаются на месте", async () => {
    respond(giftsAnswer([gift()]));
    await mount();

    await blur();
    // The refresh has not answered yet: the screen must keep the list it already shows.
    api.apiRequest.mockImplementation((path: string) =>
      path === "/api/v1/me" ? Promise.resolve({ ok: true, data: user }) : new Promise(() => {}),
    );
    await refocus();

    expect(listReads()).toBe(2);
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(0);
    expect(text()).not.toContain("Загружаем вишлист");
    expect(text()).toContain("Наушники");
    expect(button("Повторить")).toBeUndefined();
  });

  /**
   * Review m9 follow-up: a silent refresh that fails must not throw away the list the
   * person is reading. The failure is reported by the toast alone; the retry view is
   * reserved for a first load and for «Повторить» (both run from the skeleton).
   */
  it("обрыв сети при обновлении после возврата: карточки остаются, только toast", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    expect(text()).toContain("Наушники");

    await blur();
    respond({ ok: false, network: true });
    await refocus();

    expect(listReads()).toBe(2);
    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
    expect(button("Повторить")).toBeUndefined();
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("ответ не по контракту после возврата: карточки остаются, общий toast", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    expect(text()).toContain("Наушники");

    await blur();
    respond(giftsAnswer([{ ...gift(), bought: true }]));
    await refocus();

    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(text()).toContain("Не получилось. Попробуйте ещё раз.");
    expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("ошибка кода API после возврата: карточки остаются, toast с текстом кода", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    expect(text()).toContain("Наушники");

    await blur();
    respond({ ok: false, code: "FORBIDDEN", message: "" });
    await refocus();

    expect(text()).toContain("Наушники");
    expect(text()).toContain("Нет доступа.");
    expect(text()).not.toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeUndefined();
  });

  it("ответ обновления, пришедший после ухода с экрана, данные не меняет", async () => {
    respond(giftsAnswer([gift()]));
    await mount();

    await blur();
    let answer: (value: unknown) => void = function pendingAnswer() {};
    api.apiRequest.mockImplementation((path: string) =>
      path === "/api/v1/me"
        ? Promise.resolve({ ok: true, data: user })
        : new Promise((resolve) => {
            answer = resolve;
          }),
    );
    await refocus();
    await blur();
    await act(async () => {
      answer(giftsAnswer([gift({ id: "g2", title: "Свитер" })]));
    });

    expect(text()).toContain("Наушники");
    expect(text()).not.toContain("Свитер");
  });
});

/**
 * Story 2.2: the create screen unmounts on the way back, so it hands its «Добавлено в
 * вишлист» notice over in `?toast=gift_created` (the same hand-over the login screen
 * gets in `?reason=`). The list shows it once and drops the param, so a refocus — and
 * the refetch that comes with it — never replays it.
 */
describe("мой вишлист: весточка от формы создания", () => {
  it("показывает «Добавлено в вишлист» из параметра и гасит параметр", async () => {
    search.params = { toast: "gift_created" };
    respond(giftsAnswer([gift()]));
    await mount();

    expect(text()).toContain("Добавлено в вишлист");
    // The list is loaded behind the toast, as usual.
    expect(text()).toContain("Наушники");
    // One-shot: the param is cleared right away (expo-router drops `undefined` keys).
    expect(navigation.setParams).toHaveBeenCalledWith({ toast: undefined });
  });

  it("вторая весточка в той же сессии списка снова показывает подтверждение", async () => {
    search.params = { toast: "gift_created" };
    respond(giftsAnswer([gift()]));
    await mount();

    expect(text()).toContain("Добавлено в вишлист");
    expect(navigation.setParams).toHaveBeenCalledWith({ toast: undefined });

    // `setParams({ toast: undefined })` drops the param (expo-router does) and the
    // screen re-renders on «Закрыть»: the notice and its value are both gone.
    search.params = {};
    await press("Закрыть");
    expect(text()).not.toContain("Добавлено в вишлист");

    // A second trip to the composer hands the same notice over again.
    await blur();
    search.params = { toast: "gift_created" };
    await refocus();

    expect(text()).toContain("Добавлено в вишлист");
    expect(navigation.setParams).toHaveBeenCalledTimes(2);
  });

  it("после «Закрыть» и возврата на экран подтверждение не повторяется", async () => {
    search.params = { toast: "gift_created" };
    respond(giftsAnswer([gift()]));
    await mount();

    await press("Закрыть");
    expect(text()).not.toContain("Добавлено в вишлист");

    await blur();
    await refocus();

    expect(listReads()).toBe(2);
    expect(text()).not.toContain("Добавлено в вишлист");
  });

  it("без параметра подтверждения нет и параметр не трогается", async () => {
    respond(giftsAnswer([gift()]));
    await mount();

    expect(text()).not.toContain("Добавлено в вишлист");
    expect(navigation.setParams).not.toHaveBeenCalled();
  });
});

/**
 * Story 2.2: the edit screen hands its «Изменения сохранены.» notice over the same
 * way in `?toast=gift_updated`. The list shows it once, as an info toast, and drops
 * the param, so neither a refocus nor the refetch that comes with it replays it.
 */
describe("мой вишлист: весточка от формы редактирования", () => {
  it("показывает «Изменения сохранены.» из параметра и гасит параметр", async () => {
    search.params = { toast: "gift_updated" };
    respond(giftsAnswer([gift()]));
    await mount();

    expect(text()).toContain("Изменения сохранены.");
    // The list is loaded behind the toast, as usual.
    expect(text()).toContain("Наушники");
    // One-shot: the param is cleared right away (expo-router drops `undefined` keys).
    expect(navigation.setParams).toHaveBeenCalledWith({ toast: undefined });
  });

  it("после «Закрыть» и возврата на экран подтверждение не повторяется", async () => {
    search.params = { toast: "gift_updated" };
    respond(giftsAnswer([gift()]));
    await mount();

    await press("Закрыть");
    expect(text()).not.toContain("Изменения сохранены.");

    await blur();
    await refocus();

    expect(listReads()).toBe(2);
    expect(text()).not.toContain("Изменения сохранены.");
  });

  it("незнакомый параметр toast ничего не показывает и не трогает параметр", async () => {
    search.params = { toast: "gift_removed" };
    respond(giftsAnswer([gift()]));
    await mount();

    expect(text()).not.toContain("Изменения сохранены.");
    expect(text()).not.toContain("Добавлено в вишлист");
    expect(navigation.setParams).not.toHaveBeenCalled();
  });
});

/**
 * Story 2.3: the edit screen hands «Желание удалено.» over in
 * `?toast=gift_deleted`, the same one-shot hand-over the other form screens use.
 */
describe("мой вишлист: весточка об удалении", () => {
  it("показывает «Желание удалено.» из параметра и гасит параметр", async () => {
    search.params = { toast: "gift_deleted" };
    respond(giftsAnswer([gift()]));
    await mount();

    expect(text()).toContain("Желание удалено.");
    expect(navigation.setParams).toHaveBeenCalledWith({ toast: undefined });
  });
});

/**
 * `EXPERIENCE.md` → State Patterns → «Подписи брони» (owner column): the holder
 * name appears only in an active reservation and only when shared; `ownerAction`
 * replaces it with the phase label. The status pill stays the fallback label.
 */
describe("мой вишлист: подписи брони у владельца", () => {
  const holder = { id: "u2", nick: "oleg", displayName: "Олег" };

  it("ACTIVE с разрешённым именем: «Берёт {имя}»", async () => {
    respond(giftsAnswer([gift({ status: "RESERVED", reservedBy: holder })]));
    await mount();

    expect(text()).toContain("Берёт Олег");
    expect(text()).not.toContain("Ждёт вашего подтверждения");
    expect(text()).not.toContain("Срок брони истёк");
  });

  it("ACTIVE без разрешения: pill «Забронирован» и никакого имени", async () => {
    respond(giftsAnswer([gift({ status: "RESERVED", reservedBy: null })]));
    await mount();

    expect(text()).toContain("Забронирован");
    expect(text()).not.toContain("Берёт");
  });

  it("AWAITING_OWNER (ownerAction EXPIRED_NO_REPLY): «Срок брони истёк»", async () => {
    respond(
      giftsAnswer([
        gift({
          status: "RESERVED",
          reservedBy: holder,
          ownerAction: "EXPIRED_NO_REPLY",
        }),
      ]),
    );
    await mount();

    expect(text()).toContain("Срок брони истёк");
    expect(text()).not.toContain("Берёт Олег");
  });

  it("GIVEN (ownerAction CONFIRM_GIVEN): «Ждёт вашего подтверждения»", async () => {
    respond(
      giftsAnswer([
        gift({
          status: "RESERVED",
          reservedBy: holder,
          ownerAction: "CONFIRM_GIVEN",
        }),
      ]),
    );
    await mount();

    expect(text()).toContain("Ждёт вашего подтверждения");
    expect(text()).not.toContain("Берёт Олег");
  });
});

/**
 * `EXPERIENCE.md` → Visibility chip: on an open wish the choice is saved at once
 * (optimistic), a failure rolls the chip back, and a reserved wish keeps a plain
 * value chip. The dialog returns focus to the chip it was opened from.
 */
describe("мой вишлист: смена видимости с чипа", () => {
  it("выбор «Друзьям» виден сразу, затем toast и ответ сервера", async () => {
    respond(giftsAnswer([gift()]));
    await mount();

    await press("Всем");
    expect(dialogElement()).not.toBeNull();
    expect(text()).toContain("Кто видит «Наушники»");

    // The PATCH hangs until the test resolves it, so the optimistic chip is visible.
    let answer: (value: unknown) => void = function pendingAnswer() {};
    api.apiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (init?.method === "PATCH") {
        return new Promise((resolve) => {
          answer = resolve;
        });
      }
      return Promise.resolve(giftsAnswer([gift()]));
    });

    await chooseInDialog("Друзьям");

    expect(chip("Друзьям")).toBeDefined();
    expect(text()).not.toContain("Кто видит «Наушники»");
    expect(patchCalls()).toHaveLength(1);
    expect(patchCalls()[0]?.[1]).toEqual({
      method: "PATCH",
      body: { visibility: "FRIENDS" },
    });

    await act(async () => {
      answer({ ok: true, data: gift({ visibility: "FRIENDS" }) });
    });

    expect(text()).toContain("Видимость: друзьям");
    expect(chip("Друзьям")).toBeDefined();
  });

  it("последнее PUBLIC, ставшее FRIENDS, сразу выключает копирование", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    expect(button("Скопировать ссылку")?.getAttribute("aria-disabled")).toBe("false");

    await press("Всем");
    api.apiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (init?.method === "PATCH") {
        return Promise.resolve({ ok: true, data: gift({ visibility: "FRIENDS" }) });
      }
      return Promise.resolve(giftsAnswer([gift()]));
    });

    await chooseInDialog("Друзьям");

    expect(button("Скопировать ссылку")?.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector("#wishlist-copy-link-reason")?.textContent).toContain(
      "Нет желаний, открытых для всех",
    );
  });

  it("обрыв сети: чип откатывается ко «Всем» и toast о соединении", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    await press("Всем");

    api.apiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (init?.method === "PATCH") return Promise.resolve({ ok: false, network: true });
      return Promise.resolve(giftsAnswer([gift()]));
    });

    await chooseInDialog("Друзьям");

    expect(chip("Всем")).toBeDefined();
    expect(chip("Друзьям")).toBeUndefined();
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(text()).not.toContain("Видимость: друзьям");
  });

  it("сеть: откат чипа и тост «Нет соединения»", async () => {
    respond(giftsAnswer([gift({ visibility: "SECRET" })]));
    await mount();
    expect(chip("Секрет")?.getAttribute("aria-label")).toBe("Видимость: секрет. Изменить");
    await press("Секрет");
    expect(dialogElement()).not.toBeNull();
    const reads = listReads();

    api.apiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (init?.method === "PATCH") return Promise.resolve({ ok: false, network: true });
      return Promise.resolve(giftsAnswer([gift({ visibility: "SECRET" })]));
    });

    await chooseInDialog("Всем");

    expect(chip("Секрет")).toBeDefined();
    expect(chip("Всем")).toBeUndefined();
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    // Only the optimistic value changed: a network failure does not refetch the list.
    expect(listReads()).toBe(reads);

    // The in-flight flag is cleared, so the chip opens the dialog again.
    await press("Секрет");
    expect(dialogElement()).not.toBeNull();
  });

  it("VALIDATION: откат, текст ошибки и тихая перезагрузка списка", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    await press("Всем");
    const reads = listReads();

    api.apiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (init?.method === "PATCH") {
        return Promise.resolve({ ok: false, code: "VALIDATION", message: "" });
      }
      return Promise.resolve(giftsAnswer([gift()]));
    });

    await chooseInDialog("Друзьям");

    expect(chip("Всем")).toBeDefined();
    expect(text()).toContain("Желание уже забронировано — видимость не изменить.");
    expect(text()).not.toContain("Проверьте введённые данные.");
    // The status under the optimistic chip may have changed: the list reloads silently.
    expect(listReads()).toBe(reads + 1);
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(0);
  });

  it("NOT_FOUND: откат, прежний текст ошибки и тихая перезагрузка списка", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    await press("Всем");
    const reads = listReads();

    api.apiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (init?.method === "PATCH") {
        return Promise.resolve({ ok: false, code: "NOT_FOUND", message: "" });
      }
      return Promise.resolve(giftsAnswer([gift()]));
    });

    await chooseInDialog("Друзьям");

    expect(chip("Всем")).toBeDefined();
    expect(chip("Друзьям")).toBeUndefined();
    expect(text()).toContain("Не найдено.");
    expect(text()).not.toContain("Желание уже забронировано — видимость не изменить.");
    expect(listReads()).toBe(reads + 1);
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(0);
  });

  it("у RESERVED-карточки чип только показывает значение", async () => {
    respond(giftsAnswer([gift({ status: "RESERVED", visibility: "FRIENDS" })]));
    await mount();

    expect(text()).toContain("Друзьям");
    expect(chip("Друзьям")).toBeUndefined();
    expect(patchCalls()).toHaveLength(0);
  });

  it("«Отмена» в диалоге не меняет видимость и не зовёт API", async () => {
    respond(giftsAnswer([gift()]));
    await mount();
    await press("Всем");

    await press("Отмена");

    expect(dialogElement()).toBeNull();
    expect(chip("Всем")).toBeDefined();
    expect(patchCalls()).toHaveLength(0);
    expect(text()).not.toContain("Видимость: друзьям");
  });
});

/**
 * CLE-51: focus returns to the chip the dialog was opened from, and it does so only
 * after the layer has really left the tree — react-native-web keeps it mounted while
 * it fades out, and its focus trap pulls an early `focus()` back into the dialog.
 */
describe("мой вишлист: возврат фокуса на чип", () => {
  /** Opens the picker on the only wish and returns the chip that opened it. */
  async function openPicker(): Promise<HTMLButtonElement> {
    respond(giftsAnswer([gift()]));
    await mount();

    const trigger = chip("Всем");
    expect(trigger).toBeDefined();
    await press("Всем");
    expect(dialogElement()).not.toBeNull();
    // The dialog opens on the selected radio, not on the trigger behind it.
    expect(document.activeElement).not.toBe(trigger);
    return trigger as HTMLButtonElement;
  }

  it("«Отмена»: фокус на чипе, который открыл диалог", async () => {
    const trigger = await openPicker();

    await press("Отмена");

    expect(dialogElement()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Esc: фокус на чипе, который открыл диалог", async () => {
    const trigger = await openPicker();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(dialogElement()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("тап по подложке: фокус на чипе, который открыл диалог", async () => {
    const trigger = await openPicker();

    await pressScrim("visibility-picker-scrim");

    expect(dialogElement()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("выбор другого значения тоже возвращает фокус на чип", async () => {
    const trigger = await openPicker();
    api.apiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (init?.method === "PATCH") {
        return Promise.resolve({ ok: true, data: gift({ visibility: "FRIENDS" }) });
      }
      return Promise.resolve(giftsAnswer([gift()]));
    });

    await chooseInDialog("Друзьям");

    expect(dialogElement()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    // Never `<body>`: the layer hands focus back instead of dropping it.
    expect(document.activeElement).not.toBe(document.body);
  });
});
