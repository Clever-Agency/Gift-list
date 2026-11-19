// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { click, dialogElement, settle } from "@/test/dom";
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

/** The first read answers `card`, the release answers `release`. */
function respond(card: GiftCard, release: unknown = { ok: true, data: { id: "g1" } }) {
  api.apiRequest.mockImplementation(function answer(path: string, init?: { method?: string }) {
    if (path === "/api/v1/me") return Promise.resolve({ ok: true, data: user });
    if (path === "/api/v1/gifts/g1" && (init?.method ?? "GET") === "GET") {
      return Promise.resolve({ ok: true, data: card });
    }
    if (path === "/api/v1/gifts/g1/reserve" && init?.method === "DELETE") {
      return Promise.resolve(release);
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
