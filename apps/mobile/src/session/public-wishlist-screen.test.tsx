// @vitest-environment happy-dom
import { breakpoints, spacing } from "@gift-list/ui";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, settle } from "@/test/dom";
import { declarationsFor, findByPaint, paintedSpace, paintedValue } from "@/test/tamagui-css";
import { cardGrid, pageGutter } from "@/ui/card-grid";
import PublicWishlistScreen from "../../app/wishlist/[token]";

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
  return { ok: true, data: { access: "not_found", gifts: [] } };
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

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <PublicWishlistScreen />
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
  search.params = { token: "tok_1" };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
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

  it("протухший токен в чтении списка: выходит и сразу повторяет чтение как гость", async () => {
    let linkReads = 0;
    function answer(path: string) {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/session") {
        return Promise.resolve({ ok: true, data: { signedOut: true } });
      }
      if (String(path).startsWith("/api/v1/l/")) {
        linkReads += 1;
        return Promise.resolve(
          linkReads === 1
            ? { ok: false, code: "UNAUTHENTICATED", message: "" }
            : giftsAnswer([gift()]),
        );
      }
      return Promise.resolve({ ok: false, code: "NOT_FOUND", message: "" });
    }
    api.apiRequest.mockImplementation(answer);
    await mount();

    expect(linkReads).toBe(2);
    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(text()).toContain("Аня");
    expect(text()).toContain("Наушники");
    // The stale session is not a network failure: no network error or toast.
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
  });

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

describe("вишлист по ссылке: список", () => {
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

  it("NOT_FOUND и not_found дают один и тот же нейтральный экран без данных", async () => {
    respond({ ok: false, code: "NOT_FOUND", message: "" });
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
    { width: 360, columns: 1 },
    { width: 599, columns: 1 },
    { width: 600, columns: 1 },
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
      join(dirname(fileURLToPath(import.meta.url)), "../../app/wishlist/[token].tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/\bpageGutter\b/);
  });

  it("экран отрисован: имя владельца, сетка из четырёх желаний, тег и подвал", async () => {
    await mountAt(1024);

    expect(container.querySelector('[data-testid="public-wishlist-page"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="wishlist-owner"]')?.textContent).toContain(
      "Аня",
    );
    expect(container.querySelector('[role="heading"][aria-level="1"]')?.textContent).toBe(
      "Аня",
    );
    expect(container.querySelectorAll('[role="list"] [role="listitem"]')).toHaveLength(4);
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
});
