// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, dialogElement, settle, typeInto } from "@/test/dom";
import MyWishlistScreen from "../../app/(app)/(tabs)/index";
import GiftDetailScreen from "../../app/(app)/gifts/[id]/index";
import EditGiftScreen from "../../app/(app)/gifts/[id]/edit";
import NewGiftScreen from "../../app/(app)/gifts/new";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const gifts = vi.hoisted(() => ({
  fetchMyGifts: vi.fn(),
  createGift: vi.fn(),
  fetchGift: vi.fn(),
  updateGift: vi.fn(),
  restoreGift: vi.fn(),
}));
const tagApi = vi.hoisted(() => ({ fetchTagCatalog: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));

/**
 * A minimal expo-router for the two flows: a stack of routes where only the top
 * one is rendered. `push` opens a screen, `dismissTo` pops back to the list with
 * the one-shot `?toast=` the form handed over, and `setParams` merges (dropping
 * `undefined` keys) the way expo-router does. `useFocusEffect` runs its effect
 * while its screen is mounted — the top route here — so a list that comes back
 * mounts again and refetches, like its focus effect does on the real router.
 */
const navigation = vi.hoisted(() => {
  type Params = Record<string, string | undefined>;
  type Route = { pathname: string; params: Params };
  type Target = string | { pathname: string; params?: Params };

  const listeners = new Set<() => void>();
  let stack: Route[] = [{ pathname: "/", params: {} }];

  function normalize(target: Target): Route {
    return typeof target === "string"
      ? { pathname: target, params: {} }
      : { pathname: target.pathname, params: { ...target.params } };
  }

  function commit(next: Route[]) {
    stack = next;
    for (const listener of listeners) listener();
  }

  const router = {
    push(target: Target) {
      commit([...stack, normalize(target)]);
    },
    replace(target: Target) {
      const top = normalize(target);
      commit([...stack.slice(0, Math.max(0, stack.length - 1)), top]);
    },
    dismissTo(target: Target) {
      // The list is the only route dismissed to in these flows.
      commit([normalize(target)]);
    },
    back() {
      if (stack.length > 1) commit(stack.slice(0, -1));
    },
    canGoBack() {
      return stack.length > 1;
    },
    setParams(next: Params) {
      const top = stack[stack.length - 1];
      if (!top) return;
      const params = { ...top.params };
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined) delete params[key];
        else params[key] = value;
      }
      commit([...stack.slice(0, -1), { ...top, params }]);
    },
  };

  return {
    router,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // The array identity changes on every commit, so React sees each change.
    snapshot: () => stack,
    reset: () => {
      stack = [{ pathname: "/", params: {} }];
    },
    pathname: () => stack[stack.length - 1]?.pathname ?? "/",
    params: () => stack[stack.length - 1]?.params ?? {},
  };
});

vi.mock("@/api/client", () => api);
// The flows live between screens: each screen's `my-gifts` calls are driven
// directly, so the assertions see the mapped `GiftInput` / `GiftUpdate`.
vi.mock("@/api/my-gifts", () => gifts);
vi.mock("@/api/tags", () => tagApi);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
// The discard dialog draws its close cross with `expo-symbols`; it is decorative.
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
    router: navigation.router,
    Stack: { Screen: () => null },
    useLocalSearchParams: () => navigation.params(),
    // An honest `asChild`: the router's `Link` hands `href` and `onPress` to its
    // only child and draws nothing of its own — the wish card is the anchor.
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
      function onPress() {
        navigation.router.push(href as { pathname: string; params?: Record<string, string> });
      }
      if (!asChild) return React.createElement("a", { href: target, onClick: onPress }, children);
      return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        href: target,
        onPress,
      });
    },
    // The mounted top route is the focused screen: the effect lives as long as
    // that screen is rendered, like focus/blur around a pushed screen.
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
  };
});
// The forms' discard guard blocks the system back; these flows cover «Отмена» and
// the save, which never pass through it.
vi.mock("expo-router/react-navigation", () => ({
  usePreventRemove: () => undefined,
  useNavigation: () => ({ dispatch: vi.fn() }),
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
    title: "Свитер",
    description: "Синий",
    priceAmount: 105000,
    priceCurrency: "BYN",
    linkUrl: "https://example.com/sviter",
    visibility: "FRIENDS",
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

/** `/api/v1/me` answers with the session; the sign-out call answers with success. */
function signedIn() {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? { ok: true, data: user } : { ok: true, data: { signedOut: true } },
    ),
  );
}

/** The owner list answer `fetchMyGifts` resolves with. */
function listAnswer(cards: GiftCard[], archived: GiftCard[] = []) {
  return { ok: true, access: "gifts" as const, gifts: cards, archived };
}

let root: Root;
let container: HTMLElement;

/** The top route's screen, as expo-router would have it on screen. */
function Routes() {
  const stack = useSyncExternalStore(
    navigation.subscribe,
    navigation.snapshot,
    navigation.snapshot,
  );
  switch (stack[stack.length - 1]?.pathname) {
    case "/":
      return <MyWishlistScreen />;
    case "/gifts/new":
      return <NewGiftScreen />;
    case "/gifts/[id]":
      return <GiftDetailScreen />;
    case "/gifts/[id]/edit":
      return <EditGiftScreen />;
    default:
      return null;
  }
}

/** Everything on screen, layers included: a `Dialog` is portalled outside the container. */
function text(): string {
  return document.body.textContent ?? "";
}

function field(label: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll<HTMLInputElement>("input, textarea")).find(
    (node) => node.getAttribute("aria-label") === label,
  );
  expect(input, `поле «${label}»`).toBeDefined();
  return input as HTMLInputElement;
}

/** Controlled input: set the value past React's tracker, then let React see the `input` event. */
async function type(label: string, value: string) {
  const input = field(label);
  await typeInto(input, value);
}

/** A button found by its visible label (primary buttons, chips, radios). */
function button(label: string): HTMLElement | undefined {
  return controls(document).find((node) =>
    (node.textContent ?? "").includes(label),
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

/** A press inside the open layer: the page's own «Изменить» stays behind it. */
async function pressInDialog(label: string) {
  const dialog = dialogElement();
  expect(dialog, `слой для «${label}»`).toBeDefined();
  const target = controls(dialog as HTMLElement).find((node) =>
    (node.textContent ?? "").includes(label),
  );
  expect(target, `кнопка «${label}» в слое`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/** The wish card's main zone: a link whose accessible name is the content phrase. */
async function pressCard(title: string) {
  const target = container.querySelector('[role="listitem"] [role="link"]');
  expect(target?.getAttribute("aria-label")).toContain(title);
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/** A chosen radio in the currency chips or the visibility rows. */
function chosen(label: string): boolean {
  return (
    container.querySelector(`[role="radio"][aria-label="${label}"]`)?.getAttribute("aria-checked") ===
    "true"
  );
}

/** Lets pending effects and promises settle (navigation reads, fetch answers). */
async function flush() {
  await act(async () => {});
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <Routes />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  navigation.reset();
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  tagApi.fetchTagCatalog.mockResolvedValue({ ok: true, tags: [] });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/**
 * Story 2.2, create flow across screens (FR-10, AD-12, AD-17): «Добавить
 * желание» on the list opens the composer, the composer maps the form values
 * onto `GiftInput` and hands «Добавлено в вишлист» over in `?toast=`; the list
 * shows the notice and reads the owner list again, so the new wish is there.
 */
describe("поток: создание желания из списка", () => {
  it("список → форма → createGift(GiftInput) → список с «Добавлено в вишлист» и новым желанием", async () => {
    const existing = gift();
    const created = gift({
      id: "g2",
      title: "Наушники",
      description: null,
      priceAmount: 25050,
      priceCurrency: "RUB",
      linkUrl: "https://example.com/wh-1000xm5",
      visibility: "FRIENDS",
    });
    signedIn();
    gifts.fetchMyGifts
      .mockResolvedValueOnce(listAnswer([existing]))
      .mockResolvedValue(listAnswer([created, existing]));
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });

    await mount();
    expect(text()).toContain("Свитер");
    expect(gifts.fetchMyGifts).toHaveBeenCalledTimes(1);

    await press("Добавить желание");
    expect(navigation.pathname()).toBe("/gifts/new");
    expect(text()).toContain("Новое желание");

    await type("Название", "Наушники");
    await type("Ссылка (необязательно)", "https://example.com/wh-1000xm5");
    await type("Цена (необязательно)", "250,5");
    await press("RUB");
    await press("Друзьям");
    await press("Добавить желание");
    await flush();

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
    expect(gifts.createGift).toHaveBeenCalledWith({
      title: "Наушники",
      description: null,
      linkUrl: "https://example.com/wh-1000xm5",
      // `250,5` → integer minor units; the picked currency rides along (AD-25).
      priceAmount: 25050,
      priceCurrency: "RUB",
      visibility: "FRIENDS",
      quantity: "SINGLE",
      expiresOn: null,
    });

    // `dismissTo` pops the composer and the list shows the handed-over notice.
    expect(navigation.pathname()).toBe("/");
    expect(navigation.params()).toEqual({});
    expect(text()).toContain("Добавлено в вишлист");
    // And it read the owner list again on the way back: the new wish is there.
    expect(gifts.fetchMyGifts).toHaveBeenCalledTimes(2);
    expect(text()).toContain("Наушники");
    expect(text()).toContain("Свитер");
  });
});

/**
 * The discard step's «Сохранить» runs the form's own submit, so the same create
 * flow works from the dialog: the draft is saved and the list shows the notice
 * instead of the unsaved draft being dropped.
 */
describe("поток: сохранение из шага «Сохранить изменения?»", () => {
  it("форма → «Отмена» → «Сохранить» в диалоге → createGift → список с «Добавлено в вишлист»", async () => {
    const created = gift({ id: "g2", title: "Наушники" });
    signedIn();
    gifts.fetchMyGifts
      .mockResolvedValueOnce(listAnswer([]))
      .mockResolvedValue(listAnswer([created]));
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });

    await mount();
    await press("Добавить желание");
    await type("Название", "Наушники");
    await press("Отмена");

    expect(text()).toContain("Сохранить изменения?");
    await press("Сохранить");
    await flush();

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
    expect(navigation.pathname()).toBe("/");
    expect(text()).toContain("Добавлено в вишлист");
    expect(text()).toContain("Наушники");
  });
});

/**
 * Story 2.2, edit flow across screens: the owner card opens the wish page
 * `/gifts/{id}` (CLE-129, T4.4), «Изменить» there asks the neutral question first
 * (T4.4a, D-49) and the question's «Изменить» opens `/gifts/[id]/edit` with
 * the id, the screen reads that wish and prefills the form, the changed field
 * travels back as `GiftUpdate`, and the list shows «Изменения сохранены.» from
 * `?toast=` over a freshly read list.
 */
describe("поток: редактирование желания из списка", () => {
  it("список → карточка → edit с id → fetchGift → правка → updateGift(id, GiftUpdate) → список с «Изменения сохранены.»", async () => {
    const stored = gift();
    const updated = gift({ title: "Свитер мериносовый" });
    signedIn();
    gifts.fetchMyGifts
      .mockResolvedValueOnce(listAnswer([stored]))
      .mockResolvedValue(listAnswer([updated]));
    gifts.fetchGift.mockResolvedValue({ ok: true, gift: stored });
    gifts.updateGift.mockResolvedValue({ ok: true, gift: updated });

    await mount();
    expect(text()).toContain("Свитер");
    expect(gifts.fetchMyGifts).toHaveBeenCalledTimes(1);

    await pressCard("Свитер");
    await flush();

    // CLE-129, T4.4 (D-63): the card opens the wish page; «Изменить» lives there,
    // and the page reads the owner card through its own route.
    expect(navigation.pathname()).toBe("/gifts/[id]");
    expect(navigation.params()).toEqual({ id: "g1" });
    expect(gifts.fetchGift).toHaveBeenCalledWith("g1");
    expect(text()).toContain("Свитер");
    await press("Изменить");
    await flush();

    // D-49 (T4.4a): the neutral question comes before the form, and its own
    // «Изменить» is the one that navigates.
    expect(text()).toContain("Изменить желание?");
    await pressInDialog("Изменить");
    await flush();

    expect(navigation.pathname()).toBe("/gifts/[id]/edit");
    expect(navigation.params()).toEqual({ id: "g1" });

    // The form is prefilled from the stored AD-12 card.
    expect(text()).toContain("Изменить желание");
    expect(field("Название").value).toBe("Свитер");
    expect(field("Описание (необязательно)").value).toBe("Синий");
    expect(field("Ссылка (необязательно)").value).toBe("https://example.com/sviter");
    expect(field("Цена (необязательно)").value).toBe("1050");
    expect(chosen("BYN")).toBe(true);
    expect(chosen("Друзьям")).toBe(true);

    await type("Название", "Свитер мериносовый");
    await press("Сохранить");
    await flush();

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Свитер мериносовый",
      description: "Синий",
      priceAmount: 105000,
      priceCurrency: "BYN",
      linkUrl: "https://example.com/sviter",
      visibility: "FRIENDS",
      quantity: "SINGLE",
    });

    // The edit screen pops back and hands «Изменения сохранены.» to the list.
    expect(navigation.pathname()).toBe("/");
    expect(navigation.params()).toEqual({});
    expect(text()).toContain("Изменения сохранены.");
    // The list read itself again and shows the saved title.
    expect(gifts.fetchMyGifts).toHaveBeenCalledTimes(2);
    expect(text()).toContain("Свитер мериносовый");
  });
});

/**
 * Story 2.6: the owner archive at the end of the list — a collapsed «Архив (N)»,
 * no empty section, and the ⋯ actions «Вернуть в вишлист» and «Скопировать».
 */
describe("поток: архив из списка", () => {
  const archived = gift({
    id: "g-arch",
    title: "Старый свитер",
    expiresOn: "2025-12-31",
    archivedAt: "2026-01-01T00:00:00.000Z",
    tags: [{ catalogId: "tag-electronics", label: "электроника" }],
  });

  it("не показывает пустую секцию", async () => {
    signedIn();
    gifts.fetchMyGifts.mockResolvedValue(listAnswer([gift()]));

    await mount();
    expect(text()).toContain("Свитер");
    expect(document.querySelector('[data-testid="wishlist-archive"]')).toBeNull();
    expect(text()).not.toContain("Архив (");
  });

  it("⋯ только у архивных карточек, «Скопировать» создаёт новое OPEN без даты", async () => {
    const copy = gift({ id: "g-copy", title: "Старый свитер" });
    signedIn();
    gifts.fetchMyGifts.mockResolvedValue(listAnswer([gift()], [archived]));
    gifts.createGift.mockResolvedValue({ ok: true, gift: copy });

    await mount();
    expect(text()).toContain("Архив (1)");
    expect(text()).not.toContain("Старый свитер");
    await press("Архив (1)");
    expect(text()).toContain("Старый свитер");
    expect(document.querySelectorAll('[data-testid^="wishlist-archive-menu-"]')).toHaveLength(1);

    const menu = document.querySelector('[data-testid="wishlist-archive-menu-g-arch"]');
    expect(menu).not.toBeNull();
    // Story 6.4: the ⋯ of an archived wish is named after the wish, not «Архив».
    expect(menu?.getAttribute("aria-label")).toBe("Меню: Старый свитер");
    await act(async () => {
      menu?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(text()).toContain("Вернуть в вишлист");
    expect(text()).toContain("Скопировать");

    // Exact label: press("Скопировать") would hit «Скопировать ссылку» first.
    const dialog = document.querySelector('[data-testid="wishlist-archive-menu"]');
    expect(dialog).not.toBeNull();
    const copyButton = controls(dialog as HTMLElement).find(function isCopy(node) {
      return (node.textContent ?? "").trim() === "Скопировать";
    });
    expect(copyButton).toBeDefined();
    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
    expect(gifts.createGift).toHaveBeenCalledWith({
      title: "Старый свитер",
      description: "Синий",
      linkUrl: "https://example.com/sviter",
      priceAmount: 105000,
      priceCurrency: "BYN",
      visibility: "FRIENDS",
      quantity: "SINGLE",
      tags: [{ catalogId: "tag-electronics" }],
    });
    expect(gifts.createGift.mock.calls[0][0]).not.toHaveProperty("expiresOn");
    expect(text()).toContain("Добавлено в вишлист");
    expect(text()).toContain("Старый свитер");
  });

  it("«Вернуть в вишлист» зовёт restoreGift и переносит карточку в активный список", async () => {
    const restored = gift({
      id: "g-arch",
      title: "Старый свитер",
      expiresOn: null,
      archivedAt: null,
    });
    signedIn();
    gifts.fetchMyGifts.mockResolvedValue(listAnswer([gift()], [archived]));
    gifts.restoreGift.mockResolvedValue({ ok: true, gift: restored });

    await mount();
    await press("Архив (1)");
    const menu = document.querySelector('[data-testid="wishlist-archive-menu-g-arch"]');
    await act(async () => {
      menu?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);
    await press("Вернуть в вишлист");
    await press("Сохранить");
    await flush();

    expect(gifts.restoreGift).toHaveBeenCalledWith("g-arch", null);
    expect(text()).not.toContain("Архив (");
    expect(text()).toContain("Старый свитер");
  });

  it("прошлая дата при возврате показывает ошибку поля и оставляет желание в архиве", async () => {
    signedIn();
    gifts.fetchMyGifts.mockResolvedValue(listAnswer([gift()], [archived]));
    gifts.restoreGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      field: "expiresOn",
      message: "Invalid input",
    });

    await mount();
    await press("Архив (1)");
    const menu = document.querySelector('[data-testid="wishlist-archive-menu-g-arch"]');
    await act(async () => {
      menu?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);
    await press("Вернуть в вишлист");

    const input = Array.from(document.querySelectorAll("input")).find(
      (node) => node.getAttribute("type") === "date",
    );
    expect(input).toBeDefined();
    await act(async () => {
      const field = input as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(field, "2020-01-01");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await press("Сохранить");
    await flush();

    expect(gifts.restoreGift).toHaveBeenCalledWith("g-arch", "2020-01-01");
    expect(text()).toContain("Выберите сегодняшнюю дату или более позднюю.");
    expect(text()).toContain("Архив (1)");
  });

  it("без сети копирование архивного желания говорит о потере соединения", async () => {
    signedIn();
    gifts.fetchMyGifts.mockResolvedValue(listAnswer([gift()], [archived]));
    gifts.createGift.mockResolvedValue({ ok: false, network: true });

    await mount();
    await press("Архив (1)");
    const menu = document.querySelector('[data-testid="wishlist-archive-menu-g-arch"]');
    await act(async () => {
      menu?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);
    await pressInDialog("Скопировать");

    expect(gifts.createGift).toHaveBeenCalledOnce();
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("без сети возврат из архива говорит о потере соединения и оставляет желание в архиве", async () => {
    signedIn();
    gifts.fetchMyGifts.mockResolvedValue(listAnswer([gift()], [archived]));
    gifts.restoreGift.mockResolvedValue({ ok: false, network: true });

    await mount();
    await press("Архив (1)");
    const menu = document.querySelector('[data-testid="wishlist-archive-menu-g-arch"]');
    await act(async () => {
      menu?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);
    await pressInDialog("Вернуть в вишлист");
    await pressInDialog("Сохранить");

    expect(gifts.restoreGift).toHaveBeenCalledWith("g-arch", null);
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(text()).toContain("Архив (1)");
  });
});
