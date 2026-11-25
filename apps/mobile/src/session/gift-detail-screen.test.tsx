// @vitest-environment happy-dom
import type { GiftCard, ReservationCard as ReservationCardData } from "@gift-list/contracts";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { click, dialogElement, settle, typeInto } from "@/test/dom";
import { todayInZone } from "@/ui/reservation-extend-dialog";
import GiftDetailScreen from "../../app/(app)/gifts/[id]/index";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const search = vi.hoisted(() => ({ params: { id: "g1" } as Record<string, string | undefined> }));

vi.mock("@/api/client", () => api);
vi.mock("@/session/device-time-zone", () => ({ deviceTimeZone: () => "Europe/Minsk" }));
vi.mock("@/platform/session-token", () => ({ clearSessionToken: vi.fn() }));
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
    Link: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Stack: { Screen: () => null },
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = {
  id: "u2",
  email: "anna@b.test",
  name: "Анна",
  nick: "anna",
  timeZone: "Europe/Minsk",
};

function gift(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "g1",
    title: "Наушники",
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "RESERVED",
    reservedBy: { id: "u2", nick: "anna", displayName: "Анна" },
    reservationLabel: null,
    ownerAction: null,
    reservation: {
      dueAt: "2026-12-01",
      phase: "ACTIVE",
      bought: false,
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
    },
    ...overrides,
  };
}

let root: Root;
let container: HTMLElement;

function text(): string {
  return document.body.textContent ?? "";
}

function control(label: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]')).find(
    (node) => (node.textContent ?? "").includes(label),
  );
}

function dialogControl(label: string): HTMLElement | undefined {
  return Array.from(
    dialogElement()?.querySelectorAll<HTMLElement>('button, [role="button"]') ?? [],
  ).find((node) => (node.textContent ?? "").includes(label));
}

function releaseCalls(): unknown[][] {
  return api.apiRequest.mock.calls.filter(
    ([path, init]) =>
      path === "/api/v1/gifts/g1/reserve" &&
      typeof init === "object" &&
      init !== null &&
      (init as { method?: string }).method === "DELETE",
  );
}

function giftReads(): number {
  return api.apiRequest.mock.calls.filter(([path]) => path === "/api/v1/gifts/g1").length;
}

/** The holder's one-action route of Story 5.5. */
function actionCalls(): unknown[][] {
  return api.apiRequest.mock.calls.filter(
    ([path, init]) =>
      path === "/api/v1/me/reservations/g1" &&
      typeof init === "object" &&
      init !== null &&
      (init as { method?: string }).method === "PATCH",
  );
}

function switchNamed(label: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="switch"]')).find(
    (node) => node.getAttribute("aria-label") === label,
  );
}

async function mount(extra?: ReactNode) {
  await act(async () => {
    root.render(
      <AuthProvider>
        <GiftDetailScreen />
        {extra}
      </AuthProvider>,
    );
  });
  await settle();
}

/** The answer of `PATCH /api/v1/me/reservations/:giftId` — the updated reservation card. */
function reservationCard(overrides: Partial<ReservationCardData> = {}): ReservationCardData {
  return {
    giftId: "g1",
    titleSnapshot: "Наушники",
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

/**
 * The first read answers `card`, the release answers `release`, and the holder's
 * action answers `action` (a reservation card by default).
 */
function respond(
  card: GiftCard,
  release: unknown = { ok: true, data: { id: "g1" } },
  action: unknown = { ok: true, data: reservationCard() },
) {
  api.apiRequest.mockImplementation(function answer(path: string, init?: { method?: string }) {
    if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
    if (path === "/api/v1/gifts/g1" && (init?.method ?? "GET") === "GET") {
      return Promise.resolve({ ok: true, data: card });
    }
    if (path === "/api/v1/gifts/g1/reserve" && init?.method === "DELETE") {
      return Promise.resolve(release);
    }
    if (path === "/api/v1/me/reservations/g1" && init?.method === "PATCH") {
      return Promise.resolve(action);
    }
    return Promise.resolve({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  search.params = { id: "g1" };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/**
 * Story 5.2 (UI_HOLDER): у держателя есть блок `reservation`, поэтому на детали
 * вместо подсказки «Уже забронирован» стоит `secondary` «Снять бронь» → confirm
 * «Снять бронь? Желание снова станет открытым.» → карточка сама становится `OPEN`.
 */
describe("деталь желания: снятие своей брони", () => {
  it("держатель видит «Снять бронь» вместо подсказки, гость — подсказку", async () => {
    respond(gift());
    await mount();

    expect(control("Снять бронь")).toBeDefined();
    expect(text()).not.toContain("Уже забронирован");
    expect(text()).toContain("Забронирован");

    await act(async () => root.unmount());
    root = createRoot(container);
    respond(gift({ reservation: undefined, reservedBy: null }));
    await mount();

    expect(control("Снять бронь")).toBeUndefined();
    expect(text()).toContain("Уже забронирован");
  });

  it("подтверждение снимает бронь одним DELETE и карточка сразу открыта", async () => {
    respond(gift());
    await mount();

    await click(control("Снять бронь"));
    await settle();
    expect(dialogElement()?.textContent).toContain(
      "Снять бронь? Желание снова станет открытым.",
    );

    await click(dialogControl("Снять бронь"));
    await settle();

    expect(releaseCalls()).toHaveLength(1);
    expect(releaseCalls()[0]![1]).toEqual({ method: "DELETE" });
    expect(dialogElement()).toBeNull();
    expect(text()).toContain("Открыт");
    expect(text()).toContain("Куплю сам");
    expect(text()).not.toContain("Забронирован");
  });

  it("«Отмена» ничего не отправляет и оставляет бронь", async () => {
    respond(gift());
    await mount();

    await click(control("Снять бронь"));
    await settle();
    await click(dialogControl("Отмена"));
    await settle();

    expect(releaseCalls()).toHaveLength(0);
    expect(text()).toContain("Забронирован");
  });

  it("сеть на подтверждении: общая фраза формы, карточка не меняется", async () => {
    respond(gift(), { ok: false, network: true });
    await mount();

    await click(control("Снять бронь"));
    await settle();
    await click(dialogControl("Снять бронь"));
    await settle();

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(dialogElement()).toBeNull();
    expect(text()).toContain("Забронирован");
    expect(giftReads()).toBe(1);
  });

  it("CONFLICT: тост и перечитывание желания", async () => {
    respond(gift(), { ok: false, code: "CONFLICT", message: "Reservation changed" });
    await mount();

    await click(control("Снять бронь"));
    await settle();
    await click(dialogControl("Снять бронь"));
    await settle();

    expect(text()).toContain("Конфликт данных. Обновите страницу и повторите.");
    expect(giftReads()).toBe(2);
  });

  it("подтверждение показано в слое с обеими кнопками и доступным именем", async () => {
    respond(gift());
    await mount();

    await click(control("Снять бронь"));
    await settle();

    const dialog = dialogElement();
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.textContent).toContain("Отмена");
    expect(dialog?.textContent).toContain("Снять бронь");
    const name = document.getElementById(dialog?.getAttribute("aria-labelledby") ?? "");
    expect(name?.textContent).toBe("Снять бронь? Желание снова станет открытым.");
  });
});

/**
 * Story 5.5 (`EXPERIENCE.md` → «Подписи брони», `DESIGN.md` → ReservationCard):
 * у держателя в детали те же действия, что в «Моих бронях», — подпись фазы,
 * «Продлить до…», «Купил» и «Кто видит, что это я». Снятие — из 5.2, одно.
 */
describe("деталь желания: действия держателя", () => {
  it("держатель видит фазу, продление, «Купил» и переключатели", async () => {
    respond(gift());
    await mount();

    // ACTIVE уже содержит полную дату детали, отдельной строки нет.
    expect(text()).toContain("Вы берёте · до 01.12.2026");
    expect(control("Продлить до…")).toBeDefined();
    expect(switchNamed("Купил")?.getAttribute("aria-checked")).toBe("false");
    expect(control("Кто видит, что это я")).toBeDefined();
    // Снятие из 5.2 не продублировано рядом с новыми действиями.
    const releases = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"]'),
    ).filter((node) => (node.textContent ?? "").includes("Снять бронь"));
    expect(releases).toHaveLength(1);
  });

  it("гость не видит действий держателя", async () => {
    respond(
      gift({
        reservedBy: { id: "u3", nick: "petya", displayName: "Петя" },
        reservation: undefined,
      }),
    );
    await mount();

    expect(text()).toContain("Уже забронирован");
    expect(control("Продлить до…")).toBeUndefined();
    expect(control("Кто видит, что это я")).toBeUndefined();
    expect(switchNamed("Купил")).toBeUndefined();
  });

  it("«Купил» шлёт одно действие и берёт карточку из ответа", async () => {
    respond(gift(), undefined, { ok: true, data: reservationCard({ bought: true }) });
    await mount();

    await click(switchNamed("Купил"));
    await settle();

    const calls = actionCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({
      method: "PATCH",
      body: { action: "bought", value: true },
    });
    expect(switchNamed("Купил")?.getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("Куплено");
  });

  it("двойное нажатие «Купил» не отправляет два запроса", async () => {
    let answer: (value: unknown) => void = function noop() {};
    api.apiRequest.mockImplementation(function answerWith(path: string, init?: { method?: string }) {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/gifts/g1" && (init?.method ?? "GET") === "GET") {
        return Promise.resolve({ ok: true, data: gift() });
      }
      return new Promise((resolve) => {
        answer = resolve;
      });
    });
    await mount();

    await click(switchNamed("Купил"));
    await click(switchNamed("Купил"));
    expect(actionCalls()).toHaveLength(1);

    await act(async () => {
      answer({ ok: true, data: reservationCard({ bought: true }) });
    });
    await settle();
    expect(switchNamed("Купил")?.getAttribute("aria-checked")).toBe("true");
  });

  it("сеть на действии: общий тост, карточка не меняется", async () => {
    respond(gift(), undefined, { ok: false, network: true });
    await mount();

    await click(switchNamed("Купил"));
    await settle();

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(switchNamed("Купил")?.getAttribute("aria-checked")).toBe("false");
    expect(text()).not.toContain("Куплено");
  });

  it("CONFLICT на действии: тост и перечитывание желания", async () => {
    respond(gift(), undefined, {
      ok: false,
      code: "CONFLICT",
      message: "Reservation changed",
    });
    await mount();

    await click(switchNamed("Купил"));
    await settle();

    expect(text()).toContain("Конфликт данных. Обновите страницу и повторите.");
    expect(giftReads()).toBe(2);
  });

  it("продление отправляет выбранный день и показывает дату из ответа", async () => {
    respond(gift(), undefined, {
      ok: true,
      data: reservationCard({ dueAt: "2027-01-05", phase: "ACTIVE" }),
    });
    await mount();

    await click(control("Продлить до…"));
    await settle();
    expect(dialogElement()?.textContent).toContain("Продлить до…");

    const minDue = todayInZone("Europe/Minsk");
    const input = dialogElement()?.querySelector<HTMLInputElement>('input[type="date"]');
    expect(input).not.toBeNull();
    await typeInto(input!, minDue);
    await click(dialogControl("Подтвердить"));
    await settle();

    const calls = actionCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({
      method: "PATCH",
      body: { action: "extend", dueOn: minDue },
    });
    expect(dialogElement()).toBeNull();
    expect(text()).toContain("Вы берёте · до 05.01.2027");
  });

  it("продление: день вне диапазона остаётся в диалоге с текстом сервера", async () => {
    respond(gift(), undefined, {
      ok: false,
      code: "VALIDATION",
      message: "Due date out of range",
      reason: "DUE_OUT_OF_RANGE",
      params: { max: "20.12.2026" },
    });
    await mount();

    await click(control("Продлить до…"));
    await settle();
    await click(dialogControl("Подтвердить"));
    await settle();

    expect(text()).toContain("Выберите дату не позже 20.12.2026.");
    expect(dialogElement()).not.toBeNull();
    expect(text()).toContain("Вы берёте · до 01.12.2026");
  });

  it("переключатель видимости для гостей уходит без флага владельца", async () => {
    respond(gift(), undefined, {
      ok: true,
      data: reservationCard({ holderVisibleToOthers: false }),
    });
    await mount();

    expect(text()).not.toContain("Показать владельцу, что это я");

    await click(control("Кто видит, что это я"));
    await settle();
    await click(switchNamed("Показать другим, кто берёт"));
    await settle();

    const calls = actionCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toEqual({
      method: "PATCH",
      body: {
        action: "visibility",
        holderVisibleToOthers: false,
      },
    });
    expect(switchNamed("Показать другим, кто берёт")?.getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("в GIVEN подпись «Ждёт подтверждения», продления нет, остальное на месте", async () => {
    respond(
      gift({
        reservation: {
          dueAt: "2026-12-01",
          phase: "GIVEN",
          bought: false,
          holderVisibleToOwner: false,
          holderVisibleToOthers: true,
        },
      }),
    );
    await mount();

    expect(text()).toContain("до 01.12.2026");
    expect(text()).toContain("Ждёт подтверждения");
    expect(control("Продлить до…")).toBeUndefined();
    expect(switchNamed("Купил")).toBeDefined();
    expect(control("Кто видит, что это я")).toBeDefined();
    expect(control("Снять бронь")).toBeDefined();
  });

  it("фазы AWAITING_* подписаны и продление остаётся", async () => {
    respond(
      gift({
        reservation: {
          dueAt: "2026-12-01",
          phase: "AWAITING_OWNER",
          bought: true,
          holderVisibleToOwner: false,
          holderVisibleToOthers: true,
        },
      }),
    );
    await mount();

    expect(text()).toContain("Срок истёк · ждём ответа владельца");
    expect(control("Продлить до…")).toBeDefined();
    expect(text()).toContain("Куплено");
  });
});

/**
 * R1 (CLE-119): снятие брони (5.2) и действия держателя (5.5) — одна очередь
 * запросов. Пока летит любое из них, остальные кнопки неактивны и второй запрос
 * не уходит: иначе два PATCH/DELETE гоняются за одну и ту же бронь.
 */
describe("деталь желания: одно действие за раз", () => {
  /** The session and the wish answer at once, every other request stays in flight. */
  function respondPending() {
    let answer: (value: unknown) => void = function noop() {};
    api.apiRequest.mockImplementation(function answerWith(path: string, init?: { method?: string }) {
      if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
      if (path === "/api/v1/gifts/g1" && (init?.method ?? "GET") === "GET") {
        return Promise.resolve({ ok: true, data: gift() });
      }
      return new Promise((resolve) => {
        answer = resolve;
      });
    });
    return function resolvePending(value: unknown) {
      answer(value);
    };
  }

  it("пока летит действие держателя, «Снять бронь» неактивна и не открывает confirm", async () => {
    const resolvePending = respondPending();
    await mount();

    await click(switchNamed("Купил"));
    await settle(10);
    expect(actionCalls()).toHaveLength(1);
    expect(control("Снять бронь")?.getAttribute("aria-disabled")).toBe("true");

    await click(control("Снять бронь"));
    await settle(10);
    expect(dialogElement()).toBeNull();
    expect(releaseCalls()).toHaveLength(0);

    await act(async () => {
      resolvePending({ ok: true, data: reservationCard({ bought: true }) });
    });
    await settle();
    expect(control("Снять бронь")?.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("пока летит снятие, «Купил» и продление не отправляют запрос", async () => {
    const resolvePending = respondPending();
    await mount();

    await click(control("Снять бронь"));
    await settle();
    await click(dialogControl("Снять бронь"));
    await settle(10);
    expect(releaseCalls()).toHaveLength(1);

    await click(switchNamed("Купил"));
    await click(control("Продлить до…"));
    await settle(10);
    expect(actionCalls()).toHaveLength(0);
    // Продление не открылось: на экране всё ещё confirm снятия.
    expect(dialogElement()?.textContent).toContain("Снять бронь?");

    await act(async () => {
      resolvePending({ ok: true, data: { id: "g1" } });
    });
    await settle();
    expect(control("Снять бронь")).toBeUndefined();
  });
});
