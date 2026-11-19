// @vitest-environment happy-dom
import type { ReservationCard } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { click, controlByText, dialogElement, settle } from "@/test/dom";
import ReservationsScreen from "../../app/(app)/reservations";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
}));
const search = vi.hoisted(() => ({ params: {} as Record<string, string | undefined> }));

/**
 * `useFocusEffect` stand-in: expo-router runs the callback while the screen is
 * focused and its cleanup when it blurs. `blur()`/`refocus()` walk the screen
 * through that, like a return from the wish detail would.
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
vi.mock("@/session/device-time-zone", () => zone);
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
vi.mock("expo-symbols", async () => {
  const React = await import("react");
  return {
    SymbolView: () => React.createElement("span", { "data-testid": "icon" }),
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
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = {
  id: "u2",
  email: "anna@b.test",
  name: "Анна",
  nick: "anna",
  timeZone: "Europe/Minsk",
};

const sessionReady = { ok: true, data: user };
const sessionAnonymous = {
  ok: false,
  code: "UNAUTHENTICATED",
  message: "Authentication required",
};

function card(overrides: Partial<ReservationCard> = {}): ReservationCard {
  return {
    giftId: "g1",
    titleSnapshot: "Плед",
    status: "RESERVED",
    ownerNick: "anya",
    dueAt: "2026-12-01",
    phase: "ACTIVE",
    bought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    canOpenGift: true,
    ...overrides,
  };
}

function listAnswer(cards: ReservationCard[]) {
  return { ok: true, data: { reservations: cards } };
}

/** The session, the list and the one action answer the screen can ask for. */
function respond(
  reservations: unknown,
  action?: unknown,
  session: unknown = sessionReady,
) {
  api.apiRequest.mockImplementation(function answer(path: string, init?: { method?: string }) {
    if (path === "/api/v1/me") return Promise.resolve(session);
    if (path === "/api/v1/me/reservations") return Promise.resolve(reservations);
    if (path.startsWith("/api/v1/me/reservations/")) {
      return Promise.resolve(action ?? { ok: false, code: "CONFLICT", message: "Conflict" });
    }
    if (path === "/api/v1/gifts/g1/reserve") {
      return Promise.resolve({ ok: true, data: { id: "g1" } });
    }
    void init;
    return Promise.resolve({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });
}

function updateCalls() {
  return api.apiRequest.mock.calls.filter(
    ([path]) => typeof path === "string" && path.startsWith("/api/v1/me/reservations/"),
  ) as [string, { method?: string; body?: string }][];
}

function readCalls() {
  return api.apiRequest.mock.calls.filter(([path]) => path === "/api/v1/me/reservations");
}

let root: Root;
let container: HTMLElement;

function text(): string {
  return document.body.textContent ?? "";
}

function control(label: string): HTMLElement | undefined {
  return controlByText(label, document);
}

/** A control whose accessible name is the label: the ⋮ and the switches have no text. */
function byLabel(label: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
}

function dialogControl(label: string): HTMLElement | undefined {
  const dialog = dialogElement();
  return dialog ? controlByText(label, dialog) : undefined;
}

function cardLink(giftId = "g1"): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid="reservation-${giftId}-link"]`);
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <ReservationsScreen />
      </AuthProvider>,
    );
  });
  await settle(20);
}

beforeEach(() => {
  vi.resetAllMocks();
  focusStore.reset();
  navigation.canGoBack.mockReturnValue(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/**
 * Story 5.5 (FR-25, A-14): экран «Мои брони» держателя — список, пустое
 * состояние, ошибка/повтор, действия одной карточки, busy и перечитывание на
 * `CONFLICT`/`NOT_FOUND`.
 */
describe("экран «Мои брони»", () => {
  it("показывает заголовок, снимок названия, ник и фазу", async () => {
    respond(listAnswer([card()]));
    await mount();

    expect(text()).toContain("Мои брони");
    expect(text()).toContain("Плед");
    expect(text()).toContain("у @anya");
    expect(text()).toContain("Вы берёте · до 01.12");
  });

  it("пустой список — «Броней нет» с подсказкой", async () => {
    respond(listAnswer([]));
    await mount();

    expect(text()).toContain("Броней нет");
    expect(text()).toContain("Нажмите «Куплю сам» у желания друга — бронь появится здесь.");
  });

  it("сеть на списке — текст и «Повторить», повтор перечитывает", async () => {
    respond({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    respond(listAnswer([card()]));
    await click(control("Повторить"));
    await settle(20);

    expect(text()).toContain("Плед");
  });

  it("аноним уходит на вход с возвратом на /reservations", async () => {
    respond(listAnswer([]), undefined, sessionAnonymous);
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/reservations" },
    });
  });

  it("«Купил» шлёт одно действие и заменяет карточку ответом", async () => {
    respond(listAnswer([card()]), { ok: true, data: card({ bought: true }) });
    await mount();

    await click(byLabel("Купил"));
    await settle(20);

    const calls = updateCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({
      method: "PATCH",
      body: { action: "bought", value: true },
    });
    expect(text()).toContain("Куплено");
  });

  it("двойное нажатие не отправляет два запроса", async () => {
    let answer: (value: unknown) => void = function noop() {};
    api.apiRequest.mockImplementation(function answerWith(path: string) {
      if (path === "/api/v1/me") return Promise.resolve(sessionReady);
      if (path === "/api/v1/me/reservations") return Promise.resolve(listAnswer([card()]));
      return new Promise((resolve) => {
        answer = resolve;
      });
    });
    await mount();

    await click(byLabel("Купил"));
    await click(byLabel("Купил"));
    expect(updateCalls()).toHaveLength(1);

    await act(async () => {
      answer({ ok: true, data: card({ bought: true }) });
    });
    await settle(20);
    expect(text()).toContain("Куплено");
  });

  it("сеть на действии: тост и карточка не меняется", async () => {
    respond(listAnswer([card()]), { ok: false, network: true });
    await mount();

    await click(byLabel("Купил"));
    await settle(20);

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(text()).not.toContain("Куплено");
  });

  it("CONFLICT: тост и перечитывание списка", async () => {
    respond(listAnswer([card()]), { ok: false, code: "CONFLICT", message: "Conflict" });
    await mount();
    const before = readCalls().length;

    await click(byLabel("Купил"));
    await settle(20);

    expect(text()).toContain("Конфликт данных. Обновите страницу и повторите.");
    expect(readCalls().length).toBe(before + 1);
  });

  it("переключатели видимости уходят одной парой", async () => {
    respond(listAnswer([card()]), {
      ok: true,
      data: card({ holderVisibleToOwner: true, holderVisibleToOthers: true }),
    });
    await mount();

    await click(control("Кто видит, что это я"));
    await settle(10);
    await click(byLabel("Показать владельцу, что это я"));
    await settle(20);

    const calls = updateCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({
      method: "PATCH",
      body: {
        action: "visibility",
        holderVisibleToOwner: true,
        holderVisibleToOthers: true,
      },
    });
  });

  it("продление: дата вне диапазона остаётся в диалоге с текстом сервера", async () => {
    respond(listAnswer([card()]), {
      ok: false,
      code: "VALIDATION",
      message: "Due date out of range",
      reason: "DUE_OUT_OF_RANGE",
      params: { max: "20.12.2026" },
    });
    await mount();

    await click(control("Продлить до…"));
    await settle(20);
    await click(dialogControl("Подтвердить"));
    await settle(20);

    expect(text()).toContain("Выберите дату не позже 20.12.2026.");
    expect(dialogElement()).not.toBeNull();
    expect(text()).toContain("до 01.12");
  });

  it("продление: успешный ответ заменяет карточку и порядок по сроку", async () => {
    respond(
      listAnswer([
        card(),
        card({ giftId: "g2", titleSnapshot: "Свитер", dueAt: "2026-12-05" }),
      ]),
      { ok: true, data: card({ giftId: "g2", titleSnapshot: "Свитер", dueAt: "2026-11-25" }) },
    );
    await mount();

    // Вторая карточка — «Свитер»: её «Продлить до…» — вторая по счёту.
    const extendButtons = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid$="-extend"]'),
    );
    expect(extendButtons).toHaveLength(2);
    await click(extendButtons[1]);
    await settle(20);
    await click(dialogControl("Подтвердить"));
    await settle(20);

    const body = text();
    expect(body.indexOf("Свитер")).toBeLessThan(body.indexOf("Плед"));
  });

  it("«Снять бронь» из ⋮: confirm, DELETE, карточка исчезает", async () => {
    respond(listAnswer([card()]));
    await mount();

    await click(byLabel("Меню"));
    await settle(20);
    await click(dialogControl("Снять бронь"));
    await settle(300);

    expect(text()).toContain("Снять бронь? Желание снова станет открытым.");
    await click(dialogControl("Снять бронь"));
    await settle(20);

    const release = api.apiRequest.mock.calls.filter(
      ([path, init]) =>
        path === "/api/v1/gifts/g1/reserve" &&
        typeof init === "object" &&
        init !== null &&
        (init as { method?: string }).method === "DELETE",
    );
    expect(release).toHaveLength(1);
    expect(text()).toContain("Броней нет");
  });

  it("ссылка на деталь только при canOpenGift", async () => {
    respond(listAnswer([card({ canOpenGift: false })]));
    await mount();

    expect(cardLink()).toBeNull();
    expect(byLabel("Купил")).toBeDefined();

    await act(async () => root.unmount());
    root = createRoot(container);
    respond(listAnswer([card({ canOpenGift: true })]));
    await mount();

    await click(cardLink());
    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/gifts/[id]",
      params: { id: "g1" },
    });
  });

  it("в GIVEN нет продления, но «Купил» и ⋮ на месте", async () => {
    respond(listAnswer([card({ phase: "GIVEN" })]));
    await mount();

    expect(text()).toContain("Ждёт подтверждения");
    expect(control("Продлить до…")).toBeUndefined();
    expect(byLabel("Купил")).toBeDefined();
    expect(byLabel("Меню")).toBeDefined();
  });

  it("возврат на экран тихо перечитывает список", async () => {
    respond(listAnswer([card()]));
    await mount();
    const before = readCalls().length;

    await act(async () => focusStore.set(false));
    await act(async () => focusStore.set(true));
    await settle(20);

    expect(readCalls().length).toBe(before + 1);
  });

  /**
   * R1 (CLE-119): снятие и действия одной карточки идут одной очередью. Пока
   * запрос карточки в полёте, её ⋮ и «Продлить до…» не открываются, а «Купил» не
   * шлёт второй запрос; иначе два запроса гоняются за одну бронь.
   */
  describe("одна карточка — одно действие за раз", () => {
    /** The session and the list answer; every other request stays in flight. */
    function respondPending() {
      let answer: (value: unknown) => void = function noop() {};
      api.apiRequest.mockImplementation(function answerWith(path: string) {
        if (path === "/api/v1/me") return Promise.resolve(sessionReady);
        if (path === "/api/v1/me/reservations") return Promise.resolve(listAnswer([card()]));
        return new Promise((resolve) => {
          answer = resolve;
        });
      });
      return function resolvePending(value: unknown) {
        answer(value);
      };
    }

    it("пока летит действие, ⋮ и продление не открываются", async () => {
      const resolvePending = respondPending();
      await mount();

      await click(byLabel("Купил"));
      await settle(10);
      expect(updateCalls()).toHaveLength(1);

      await click(control("Продлить до…"));
      await click(byLabel("Меню"));
      await settle(10);
      expect(dialogElement()).toBeNull();
      expect(updateCalls()).toHaveLength(1);

      await act(async () => {
        resolvePending({ ok: true, data: card({ bought: true }) });
      });
      await settle(20);
      expect(text()).toContain("Куплено");
    });

    it("пока летит снятие, «Купил» не отправляет запрос", async () => {
      const resolvePending = respondPending();
      await mount();

      await click(byLabel("Меню"));
      await settle(20);
      await click(dialogControl("Снять бронь"));
      await settle(300);
      await click(dialogControl("Снять бронь"));
      await settle(10);
      expect(
        api.apiRequest.mock.calls.filter(
          ([path, init]) =>
            path === "/api/v1/gifts/g1/reserve" &&
            typeof init === "object" &&
            init !== null &&
            (init as { method?: string }).method === "DELETE",
        ),
      ).toHaveLength(1);

      await click(byLabel("Купил"));
      await settle(10);
      expect(updateCalls()).toHaveLength(0);

      await act(async () => {
        resolvePending({ ok: true, data: { id: "g1" } });
      });
      await settle(20);
      expect(text()).toContain("Броней нет");
    });
  });
});
