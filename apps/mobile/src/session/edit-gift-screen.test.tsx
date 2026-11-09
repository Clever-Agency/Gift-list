// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, dialogElement, escape, pressScrim, settle, typeInto } from "@/test/dom";
import EditGiftScreen from "../../app/(app)/gifts/[id]/edit";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const gifts = vi.hoisted(() => ({
  fetchGift: vi.fn(),
  updateGift: vi.fn(),
  deleteGift: vi.fn(),
}));
const tagApi = vi.hoisted(() => ({ fetchTagCatalog: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const platform = vi.hoisted(() => ({ os: "android" as "android" | "web" }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  dismissTo: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(),
}));
/**
 * The vendored React Navigation contract the discard guard sits on. The navigator
 * keeps the `enabled` and the callback of the LAST COMMITTED render, so a state
 * update in the same tick is too late: a blocked removal stays blocked until that
 * value changes, and only the callback's `repeat` lets the action through at
 * once. `router.back()`, `dismissTo` and `replace` all remove this screen, so the
 * router mock asks this guard before a removal runs.
 */
const guard = vi.hoisted(() => {
  type Action = { type: string; payload?: unknown };
  type Callback = (event: { data: { action: Action }; repeat: () => void }) => void;

  let enabled = false;
  let callback: Callback | null = null;
  const dispatched: Action[] = [];

  function attemptRemove(action: Action): void {
    if (!enabled) {
      dispatched.push(action);
      return;
    }
    if (!callback) throw new Error("removePrevented без callback");
    callback({
      data: { action },
      repeat: () => {
        // The real hook turns prevention off synchronously, so the replay runs.
        enabled = false;
        dispatched.push(action);
      },
    });
  }

  return {
    register(nextEnabled: boolean, nextCallback: Callback): void {
      enabled = nextEnabled;
      callback = nextCallback;
    },
    useNavigation() {
      return { dispatch: attemptRemove };
    },
    attemptRemove,
    enabled: () => enabled,
    /** The removals that really went through, in order. */
    dispatched: () => dispatched,
    reset(): void {
      enabled = false;
      callback = null;
      dispatched.length = 0;
    },
  };
});
/** Route params stand-in: the screen reads the wish id from `[id]`. */
const search = vi.hoisted(() => ({ params: {} as Record<string, string | undefined> }));

vi.mock("@/api/client", () => api);
// The screen under test is the edit flow only: the api module's own mapping is
// covered by its callers, so the screen test drives `fetchGift`/`updateGift` directly.
vi.mock("@/api/my-gifts", () => gifts);
vi.mock("@/api/tags", () => tagApi);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
// The discard dialog draws its close cross with `expo-symbols`; decorative.
vi.mock("expo-symbols", async () => {
  const React = await import("react");
  return {
    SymbolView: () => React.createElement("span", { "data-testid": "close-icon" }),
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
vi.mock("expo-router", () => ({
  router: navigation,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => search.params,
}));
// `usePreventRemove` is mocked to the navigator's own contract: every render
// reports the current `enabled` and the callback a blocked removal calls, and the
// router's removals go through `guard.attemptRemove`.
vi.mock("expo-router/react-navigation", () => ({
  usePreventRemove: guard.register,
  useNavigation: guard.useNavigation,
}));
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

const stored: GiftCard = {
  id: "g1",
  title: "Наушники",
  description: "Чёрные, с шумоподавлением",
  priceAmount: 25000,
  priceCurrency: "RUB",
  linkUrl: "https://example.com/x",
  visibility: "FRIENDS",
  quantity: "SINGLE",
  expiresOn: null,
  archivedAt: null,
  tags: [],
  status: "OPEN",
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
};

/** `/api/v1/me` answers with the session; the sign-out call answers with success. */
function signedIn() {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? { ok: true, data: user } : { ok: true, data: { signedOut: true } },
    ),
  );
}

/** The session is alive, but the sign-out request has no connection. */
function signOutFails() {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/session"
        ? { ok: false, network: true }
        : path === "/api/v1/me"
          ? { ok: true, data: user }
          : { ok: true, data: { signedOut: true } },
    ),
  );
}

/** The screen's first read answers with the stored wish. */
function loaded(gift: GiftCard = stored) {
  signedIn();
  gifts.fetchGift.mockResolvedValue({ ok: true, gift });
}

let root: Root;
let container: HTMLElement;

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

/** The field box: its label, input and the inline message under it. */
function fieldText(label: string): string {
  return field(label).parentElement?.textContent ?? "";
}

/** Controlled input: set the value past React's tracker, then let React see the `input` event. */
async function type(label: string, value: string) {
  const input = field(label);
  await typeInto(input, value);
}

function button(label: string): HTMLElement | undefined {
  return controls(document).find((node) =>
    (node.textContent ?? "").includes(label),
  );
}

/** A chosen radio in the currency chips or the visibility rows. */
function selected(label: string): boolean {
  return container.querySelector(`[role="radio"][aria-label="${label}"]`)?.getAttribute("aria-checked") === "true";
}

async function press(label: string) {
  const target = button(label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/**
 * Exact accessible name, for «Удалить» next to «Удалить желание» and for the
 * dialog's «Отмена» next to the form's own cancel button.
 */
function buttonByLabel(label: string): HTMLElement | undefined {
  return controls(document).find(
    (node) => node.getAttribute("aria-label") === label,
  );
}

async function pressExact(label: string) {
  // The open dialog wins: its «Отмена» is not the form's «Отмена».
  const target = dialogLabeled(label) ?? buttonByLabel(label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/** A button inside the open confirm dialog: «Отмена» exists twice on a dirty form. */
function dialogButton(label: string): HTMLElement | undefined {
  const dialog = dialogElement();
  if (!dialog) return undefined;
  return controls(dialog).find((node) =>
    (node.textContent ?? "").includes(label),
  );
}

async function pressInDialog(label: string) {
  const target = dialogButton(label);
  expect(target, `кнопка «${label}» в диалоге`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/** A dialog button by its accessible name: the close cross has no visible text. */
function dialogLabeled(label: string): HTMLElement | undefined {
  const dialog = dialogElement();
  if (!dialog) return undefined;
  return controls(dialog).find(
    (node) => node.getAttribute("aria-label") === label,
  );
}

async function pressInDialogLabeled(label: string) {
  const target = dialogLabeled(label);
  expect(target, `кнопка «${label}» в диалоге`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/** Esc reaches the open layer from the document, as in the browser. */
async function escapeDialog() {
  await act(async () => {
    escape();
  });
  await settle(10);
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <EditGiftScreen />
      </AuthProvider>,
    );
  });
}

/** A blocked navigation action, as the navigator hands it to `usePreventRemove`. */
const goBack = { type: "GO_BACK" };

/** System back: the navigator tries to remove the screen and the guard sees it. */
async function systemBack() {
  await act(async () => guard.attemptRemove(goBack));
}

/** The browser's own Back: it changes the entry first, then the page hears about it. */
async function browserBack() {
  await act(async () => {
    window.history.back();
  });
}

/**
 * expo-router after the browser's Back has moved the page to the list: it
 * restores that entry's saved screen, which removes this one, so the navigator
 * asks the guard first. A refused removal puts the browser back on the form's
 * entry — the "съеденный" exit this suite guards against.
 */
async function routerRestoresPreviousPage() {
  const before = guard.dispatched().length;
  await act(async () => {
    guard.attemptRemove({ type: "POP" });
  });
  if (guard.dispatched().length > before) return;
  await act(async () => {
    window.history.go(1);
  });
}

/** The wish's edit form opened from the list in the browser. */
function listThenForm() {
  platform.os = "web";
  window.history.replaceState({ id: "list" }, "", "/");
  window.history.pushState({ id: "form" }, "", "/gifts/g1/edit");
}

beforeEach(() => {
  vi.resetAllMocks();
  guard.reset();
  platform.os = "android";
  search.params = { id: "g1" };
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  // Story 2.5: the form always asks for the fixed catalogue; an empty one is a
  // normal state and tests that need tags override this answer.
  tagApi.fetchTagCatalog.mockResolvedValue({ ok: true, tags: [] });
  // A direct link left nothing to go back to: the screen replaces itself with the list.
  navigation.canGoBack.mockReturnValue(false);
  // A router call that removes this screen is a removal like the system back.
  navigation.back.mockImplementation(() => guard.attemptRemove({ type: "GO_BACK" }));
  navigation.dismissTo.mockImplementation((target: unknown) =>
    guard.attemptRemove({ type: "POP_TO", payload: target }),
  );
  navigation.replace.mockImplementation((target: unknown) =>
    guard.attemptRemove({ type: "REPLACE", payload: target }),
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("изменение желания: гейт сессии", () => {
  it("пока сессия неизвестна, показывает общий экран загрузки, а не пустую страницу", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    const region = container.querySelector('[data-testid="session-loading"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(1);
  });

  it("аноним уходит на вход с возвратом в форму редактирования", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/g1/edit" },
    });
    // Until the redirect lands the page still says «Загружаем», not blank.
    expect(container.querySelector('[data-testid="session-loading"]')).not.toBeNull();
  });
});

describe("изменение желания: загрузка", () => {
  it("пока желание грузится, показывает skeleton без формы", async () => {
    signedIn();
    gifts.fetchGift.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(1);
    expect(text()).not.toContain("Название");
    expect(button("Сохранить")).toBeUndefined();
  });

  it("skeleton объявлен диктору: занятая область с подписью «Загружаем желание»", async () => {
    signedIn();
    gifts.fetchGift.mockReturnValue(new Promise(() => {}));
    await mount();

    const region = container.querySelector('[aria-label="Загружаем желание"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(1);
  });

  it("заполняет форму полями желания и подписью «Сохранить»", async () => {
    loaded();
    await mount();

    expect(gifts.fetchGift).toHaveBeenCalledWith("g1");
    expect(text()).toContain("Изменить желание");
    expect(field("Название").value).toBe("Наушники");
    expect(field("Описание (необязательно)").value).toBe("Чёрные, с шумоподавлением");
    expect(field("Ссылка (необязательно)").value).toBe("https://example.com/x");
    expect(field("Цена (необязательно)").value).toBe("250");
    expect(selected("RUB")).toBe(true);
    expect(selected("Друзьям")).toBe(true);
    expect(selected("Один раз")).toBe(true);
    expect(button("Сохранить")).toBeDefined();
  });

  it("обрыв сети: тело с повтором, toast, затем «Повторить» открывает форму", async () => {
    signedIn();
    gifts.fetchGift.mockResolvedValue({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();
    expect(button("Сохранить")).toBeUndefined();

    gifts.fetchGift.mockResolvedValue({ ok: true, gift: stored });
    await press("Повторить");

    expect(gifts.fetchGift).toHaveBeenCalledTimes(2);
    expect(field("Название").value).toBe("Наушники");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("ответ не по контракту: общее тело ошибки, общий toast и повтор", async () => {
    signedIn();
    gifts.fetchGift.mockResolvedValue({ ok: false, invalid: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).toContain("Не получилось. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();
  });

  it("желания нет: «Желание не найдено.» и возврат к списку, а не пустая форма", async () => {
    signedIn();
    gifts.fetchGift.mockResolvedValue({ ok: false, code: "NOT_FOUND", message: "" });
    await mount();

    expect(text()).toContain("Желание не найдено.");
    expect(button("Сохранить")).toBeUndefined();
    expect(button("К моему вишлисту")).toBeDefined();

    await press("К моему вишлисту");
    expect(navigation.dismissTo).toHaveBeenCalledWith({ pathname: "/" });
  });

  it("401 при загрузке: гасит сессию и уводит на вход с возвратом и причиной", async () => {
    signedIn();
    gifts.fetchGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/g1/edit", reason: "session_expired" },
    });
    expect(text()).not.toContain("Сессия закончилась, войдите снова");
  });
});

describe("изменение желания: сохранение", () => {
  it("успех: шлёт полный GiftUpdate и уводит к списку с toast=gift_updated", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: true, gift: { ...stored, title: "Наушники Sony" } });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Наушники Sony",
      description: "Чёрные, с шумоподавлением",
      priceAmount: 25000,
      priceCurrency: "RUB",
      // `GiftFormValues` calls the field `link`, the API body `linkUrl` (AD-12).
      linkUrl: "https://example.com/x",
      visibility: "FRIENDS",
      quantity: "SINGLE",
    });
    // The screen unmounts on the way back, so the confirmation is the list's to show.
    expect(text()).not.toContain("Изменения сохранены.");
    expect(navigation.dismissTo).toHaveBeenCalledTimes(1);
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_updated" },
    });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  /**
   * AD-25: the amount and its currency are all-or-nothing. Clearing the prefilled
   * amount clears the stored currency with it, so the price disappears instead of
   * keeping `RUB` next to a `null` amount.
   */
  it("очистка цены шлёт priceAmount: null и priceCurrency: null", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({
      ok: true,
      gift: { ...stored, priceAmount: null, priceCurrency: null },
    });
    await mount();

    await type("Цена (необязательно)", "");
    // An empty amount hides the currency choice (EXPERIENCE → Price field).
    expect(text()).not.toContain("Валюта");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Наушники",
      description: "Чёрные, с шумоподавлением",
      priceAmount: null,
      priceCurrency: null,
      linkUrl: "https://example.com/x",
      visibility: "FRIENDS",
      quantity: "SINGLE",
    });
  });

  /** Story 2.5: editing another field still sends the stored type, never `SINGLE`. */
  it("правка названия не сбрасывает UNLIMITED и остальные поля", async () => {
    const unlimited: GiftCard = { ...stored, quantity: "UNLIMITED" };
    loaded(unlimited);
    gifts.updateGift.mockResolvedValue({
      ok: true,
      gift: { ...unlimited, title: "Наушники Sony" },
    });
    await mount();

    expect(selected("Можно дарить снова")).toBe(true);
    expect(selected("Один раз")).toBe(false);

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Наушники Sony",
      description: "Чёрные, с шумоподавлением",
      priceAmount: 25000,
      priceCurrency: "RUB",
      linkUrl: "https://example.com/x",
      visibility: "FRIENDS",
      quantity: "UNLIMITED",
    });
  });

  /** D-25: an empty link clears the stored one instead of silently keeping it. */
  it("очистка ссылки шлёт linkUrl: null", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: true, gift: { ...stored, linkUrl: null } });
    await mount();

    await type("Ссылка (необязательно)", "");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Наушники",
      description: "Чёрные, с шумоподавлением",
      priceAmount: 25000,
      priceCurrency: "RUB",
      linkUrl: null,
      visibility: "FRIENDS",
      quantity: "SINGLE",
    });
  });

  it("VALIDATION: ошибка появляется у поля, форма остаётся с введённым", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(fieldText("Название")).toContain("Напишите, что вы хотите.");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(text()).not.toContain("Не получилось сохранить. Попробуйте ещё раз.");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("NOT_FOUND при сохранении: toast и состояние «Желание не найдено.»", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: false, code: "NOT_FOUND", message: "" });
    await mount();

    await press("Сохранить");

    expect(text()).toContain("Не найдено.");
    expect(text()).toContain("Желание не найдено.");
    expect(button("Сохранить")).toBeUndefined();
    expect(button("К моему вишлисту")).toBeDefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("обрыв сети при сохранении: toast и форма с прежними значениями", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(field("Цена (необязательно)").value).toBe("250");
    expect(button("Сохранить")).toBeDefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("ответ не по контракту: общий toast и форма на месте", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: false, invalid: true });
    await mount();

    await press("Сохранить");

    expect(text()).toContain("Не получилось. Попробуйте ещё раз.");
    expect(button("Сохранить")).toBeDefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("401 при сохранении: гасит сессию и уводит на вход с возвратом и причиной", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    await press("Сохранить");

    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/g1/edit", reason: "session_expired" },
    });
  });

  it("пока запрос идёт, кнопка недоступна и второй тап не шлёт второй запрос", async () => {
    loaded();
    gifts.updateGift.mockReturnValue(new Promise(() => {}));
    await mount();

    await press("Сохранить");

    const submit = button("Сохранить");
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect(submit?.getAttribute("aria-disabled")).toBe("true");
    expect(gifts.updateGift).toHaveBeenCalledTimes(1);

    await act(async () => {
      submit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
  });
});

describe("изменение желания: отмена", () => {
  it("чистая форма: сразу назад, без вопроса", async () => {
    loaded();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await press("Отмена");

    expect(guard.dispatched()).toEqual([{ type: "GO_BACK" }]);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("чистая форма без истории: уводит к списку", async () => {
    loaded();
    await mount();

    await press("Отмена");

    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).toHaveBeenCalledWith({ pathname: "/" });
    expect(guard.dispatched()).toEqual([{ type: "POP_TO", payload: { pathname: "/" } }]);
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("после правки отмена спрашивает и не уводит", async () => {
    loaded();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await type("Название", "Наушники Sony");
    await press("Отмена");

    expect(text()).toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("крестик «Закрыть» прячет вопрос и оставляет введённое", async () => {
    loaded();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await type("Название", "Наушники Sony");
    await press("Отмена");
    await pressInDialogLabeled("Закрыть");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(button("Сохранить")).toBeDefined();
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("«Не сохранять» уводит назад и не спрашивает снова", async () => {
    loaded();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await type("Название", "Наушники Sony");
    await press("Отмена");
    // The navigator still holds the guarded registration of the last render: the
    // dialog's answer must not be stopped by it a second time.
    expect(guard.enabled()).toBe(true);
    await pressInDialog("Не сохранять");

    expect(guard.dispatched()).toEqual([{ type: "GO_BACK" }]);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(text()).not.toContain("Сохранить изменения?");
    expect(gifts.updateGift).not.toHaveBeenCalled();
  });

  it("«Не сохранять» без истории уводит к списку и не спрашивает снова", async () => {
    loaded();
    await mount();

    await type("Название", "Наушники Sony");
    await press("Отмена");
    expect(guard.enabled()).toBe(true);
    await pressInDialog("Не сохранять");

    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).toHaveBeenCalledWith({ pathname: "/" });
    expect(guard.dispatched()).toEqual([{ type: "POP_TO", payload: { pathname: "/" } }]);
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("пока запрос идёт, отмена не спрашивает и не уводит", async () => {
    loaded();
    navigation.canGoBack.mockReturnValue(true);
    gifts.updateGift.mockReturnValue(new Promise(() => {}));
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");
    await press("Отмена");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("сохранение уводит к списку с toast и без вопроса", async () => {
    loaded();
    navigation.canGoBack.mockReturnValue(true);
    gifts.updateGift.mockResolvedValue({ ok: true, gift: stored });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_updated" },
    });
    // The saved draft leaves without a question, whatever the guard last saw.
    expect(guard.dispatched()).toEqual([
      { type: "POP_TO", payload: { pathname: "/", params: { toast: "gift_updated" } } },
    ]);
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("истёкшая сессия уводит на вход, не спрашивая о черновике", async () => {
    loaded();
    navigation.canGoBack.mockReturnValue(true);
    gifts.updateGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/g1/edit", reason: "session_expired" },
    });
    // The hand-over is our own exit: it goes through, it does not ask.
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("истёкшая сессия без связи: вход не открылся, черновик снова под защитой", async () => {
    signOutFails();
    gifts.fetchGift.mockResolvedValue({ ok: true, gift: stored });
    gifts.updateGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(navigation.replace).not.toHaveBeenCalled();
    // The hand-over never happened, so the form must ask about the draft again.
    expect(guard.enabled()).toBe(true);
    await systemBack();
    expect(text()).toContain("Сохранить изменения?");
    expect(guard.dispatched()).toEqual([]);
  });
});

describe("изменение желания: системное «назад»", () => {
  it("чистая форма: возврат не перехватывается", async () => {
    loaded();
    await mount();

    expect(guard.enabled()).toBe(false);
  });

  it("после правки возврат спрашивает и не уводит", async () => {
    loaded();
    await mount();

    await type("Название", "Наушники Sony");
    expect(guard.enabled()).toBe(true);

    await systemBack();

    expect(text()).toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(guard.dispatched()).toEqual([]);
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("«Не сохранять» повторяет ровно тот переход, что просил навигатор", async () => {
    loaded();
    await mount();

    await type("Название", "Наушники Sony");
    await systemBack();
    await pressInDialog("Не сохранять");

    expect(guard.dispatched()).toEqual([goBack]);
    // The action is the way out: the screen does not pick another one.
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(gifts.updateGift).not.toHaveBeenCalled();
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("крестик «Закрыть» не повторяет переход и оставляет введённое", async () => {
    loaded();
    await mount();

    await type("Название", "Наушники Sony");
    await systemBack();
    await pressInDialogLabeled("Закрыть");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(guard.dispatched()).toEqual([]);
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("Esc возвращает к форме, не повторяя переход", async () => {
    loaded();
    await mount();

    await type("Название", "Наушники Sony");
    await systemBack();
    await escapeDialog();

    expect(text()).not.toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(guard.dispatched()).toEqual([]);
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("«Сохранить» сохраняет, уводит к списку с toast и не повторяет заблокированный переход", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: true, gift: { ...stored, title: "Наушники Sony" } });
    await mount();

    await type("Название", "Наушники Sony");
    await systemBack();
    await pressInDialog("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Наушники Sony",
      description: "Чёрные, с шумоподавлением",
      priceAmount: 25000,
      priceCurrency: "RUB",
      linkUrl: "https://example.com/x",
      visibility: "FRIENDS",
      quantity: "SINGLE",
    });
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_updated" },
    });
    // The save has its own way out; the blocked back action is dropped.
    expect(guard.dispatched()).toEqual([
      { type: "POP_TO", payload: { pathname: "/", params: { toast: "gift_updated" } } },
    ]);
    expect(navigation.back).not.toHaveBeenCalled();
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("«Сохранить» с ошибкой проверки закрывает диалог и оставляет форму с ошибкой", async () => {
    loaded();
    await mount();

    // Clearing the title makes the draft dirty and invalid at once.
    await type("Название", "");
    await press("Отмена");
    await pressInDialog("Сохранить");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(fieldText("Название")).toContain("Напишите, что вы хотите.");
    expect(field("Название").value).toBe("");
    expect(gifts.updateGift).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("«Сохранить» с ошибкой сервера закрывает диалог и оставляет форму открытой", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("Название", "Наушники Sony");
    await systemBack();
    await pressInDialog("Сохранить");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(button("Сохранить")).toBeDefined();
    expect(guard.dispatched()).toEqual([]);
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("пока сохранение идёт, возврат не перехватывается", async () => {
    loaded();
    gifts.updateGift.mockReturnValue(new Promise(() => {}));
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(guard.enabled()).toBe(false);
  });
});

/**
 * Story 2.2 on the web (`EXPERIENCE.md` → Esc / scrim / системное «назад»):
 * the browser's Back changes the URL before the navigator is told, so
 * `usePreventRemove` misses it and the guard keeps the page on the form itself.
 */
describe("изменение желания: кнопка «назад» браузера", () => {
  it("после правки возврат браузера спрашивает и остаётся на форме", async () => {
    loaded();
    listThenForm();
    await mount();
    await type("Название", "Наушники Sony");

    await browserBack();

    expect(text()).toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники Sony");
    // The address bar still shows the form: the draft is not thrown away.
    expect(window.location.pathname).toBe("/gifts/g1/edit");
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("«Не сохранять» после возврата браузера уводит на предыдущую страницу", async () => {
    loaded();
    listThenForm();
    await mount();
    await type("Название", "Наушники Sony");
    await browserBack();

    await pressInDialog("Не сохранять");

    expect(window.location.pathname).toBe("/");
    expect(text()).not.toContain("Сохранить изменения?");
    // The way out is the browser's own Back replayed, not a second navigation.
    expect(guard.dispatched()).toEqual([]);
    expect(gifts.updateGift).not.toHaveBeenCalled();
  });

  it("«Не сохранять» после закрытого «Отменой» вопроса уводит без повторного вопроса", async () => {
    loaded();
    listThenForm();
    await mount();
    await type("Название", "Наушники Sony");

    // «Отмена» asks, the cross closes the step and keeps the draft.
    await press("Отмена");
    await pressInDialogLabeled("Закрыть");
    expect(text()).not.toContain("Сохранить изменения?");

    // The system back asks again — correctly — and the answer must leave for the
    // list even though the step had already been opened and closed once.
    await browserBack();
    expect(text()).toContain("Сохранить изменения?");

    await pressInDialog("Не сохранять");
    expect(window.location.pathname).toBe("/");
    expect(window.history.state).toMatchObject({ id: "list" });

    // The list's own screen replaces the form: that removal is the accepted way
    // out and must not be stopped by the guard of the screen that is leaving.
    await routerRestoresPreviousPage();

    expect(text(), "вопрос не задан повторно").not.toContain("Сохранить изменения?");
    expect(window.location.pathname).toBe("/");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(gifts.updateGift).not.toHaveBeenCalled();
  });
});

/**
 * `EXPERIENCE.md` → Правка забронированного желания: a wish that is no longer
 * open keeps its visibility frozen and offers no delete; an open one deletes
 * through a confirm step of the same form.
 */
describe("изменение желания: видимость и удаление", () => {
  it("RESERVED: показывает UNLIMITED, блокирует оба поля и не шлёт их", async () => {
    const reserved: GiftCard = {
      ...stored,
      status: "RESERVED",
      quantity: "UNLIMITED",
    };
    loaded(reserved);
    gifts.updateGift.mockResolvedValue({ ok: true, gift: reserved });
    await mount();

    expect(text()).toContain("Видимость меняется только у открытого желания.");
    expect(text()).toContain("Сколько раз можно дарить — меняется только у открытого желания.");
    // Editing shows the stored type, even though the control is frozen.
    expect(selected("Можно дарить снова")).toBe(true);
    expect(selected("Один раз")).toBe(false);
    for (const label of ["Один раз", "Можно дарить снова"]) {
      const radio = container.querySelector(`[role="radio"][aria-label="${label}"]`);
      expect(radio, label).not.toBeNull();
      expect(radio?.getAttribute("aria-disabled"), label).toBe("true");
    }
    expect(button("Удалить желание")).toBeUndefined();

    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    // Visibility and quantity are frozen outside OPEN, so the body omits both and
    // an unchanged save cannot reset the stored values.
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Наушники",
      description: "Чёрные, с шумоподавлением",
      priceAmount: 25000,
      priceCurrency: "RUB",
      linkUrl: "https://example.com/x",
    });
  });

  it("OPEN: «Удалить желание» открывает confirm, «Отмена» ничего не удаляет", async () => {
    loaded();
    await mount();

    await press("Удалить желание");

    expect(dialogElement()).not.toBeNull();
    expect(text()).toContain("Удалить «Наушники»?");
    expect(text()).toContain("Желание исчезнет из вишлиста. Это нельзя отменить.");

    await pressExact("Отмена");

    expect(gifts.deleteGift).not.toHaveBeenCalled();
    expect(dialogElement()).toBeNull();
    expect(button("Сохранить")).toBeDefined();
  });

  it("OPEN: «Удалить» зовёт deleteGift и уводит к списку с toast=gift_deleted", async () => {
    loaded();
    gifts.deleteGift.mockResolvedValue({ ok: true });
    await mount();

    await press("Удалить желание");
    await pressExact("Удалить");

    expect(gifts.deleteGift).toHaveBeenCalledTimes(1);
    expect(gifts.deleteGift).toHaveBeenCalledWith("g1");
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_deleted" },
    });
  });

  it("обрыв сети при удалении: диалог закрыт, toast и форма на месте", async () => {
    loaded();
    gifts.deleteGift.mockResolvedValue({ ok: false, network: true });
    await mount();

    await press("Удалить желание");
    await pressExact("Удалить");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(dialogElement()).toBeNull();
    expect(button("Сохранить")).toBeDefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("CONFLICT при удалении: toast, перечитывание желания и пропавшая кнопка удаления", async () => {
    loaded();
    // The first read is the open wish; the reload after CONFLICT shows it reserved.
    gifts.fetchGift.mockResolvedValueOnce({ ok: true, gift: stored });
    gifts.fetchGift.mockResolvedValue({
      ok: true,
      gift: { ...stored, status: "RESERVED" },
    });
    gifts.deleteGift.mockResolvedValue({ ok: false, code: "CONFLICT", message: "" });
    await mount();

    await press("Удалить желание");
    await pressExact("Удалить");

    expect(text()).toContain("Конфликт данных. Обновите страницу и повторите.");
    expect(gifts.fetchGift).toHaveBeenCalledTimes(2);
    expect(text()).toContain("Видимость меняется только у открытого желания.");
    expect(button("Удалить желание")).toBeUndefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("NOT_FOUND при удалении: toast и состояние «Желание не найдено.»", async () => {
    loaded();
    gifts.deleteGift.mockResolvedValue({ ok: false, code: "NOT_FOUND", message: "" });
    await mount();

    await press("Удалить желание");
    await pressExact("Удалить");

    expect(text()).toContain("Не найдено.");
    expect(text()).toContain("Желание не найдено.");
    expect(button("Сохранить")).toBeUndefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("двойной тап по «Удалить» шлёт один DELETE", async () => {
    loaded();
    gifts.deleteGift.mockReturnValue(new Promise(() => {}));
    await mount();

    await press("Удалить желание");
    await pressExact("Удалить");

    expect(gifts.deleteGift).toHaveBeenCalledTimes(1);
    const busy = buttonByLabel("Удаляем…");
    expect((busy as HTMLButtonElement).disabled).toBe(false);
    expect(busy?.getAttribute("aria-disabled")).toBe("true");
    await act(async () => {
      busy?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(gifts.deleteGift).toHaveBeenCalledTimes(1);
  });
});

/**
 * CLE-51: «Удалить желание» gets focus back after the confirm layer closes — but only
 * once the layer has really left the tree, and never when the delete goes through and
 * the screen leaves for the list. The dismiss itself moves focus on the web: on this
 * platform the layer hands it back through `Modal`'s `onDismiss`.
 */
describe("изменение желания: возврат фокуса после confirm", () => {
  beforeEach(() => {
    platform.os = "web";
  });

  /** Opens the confirm layer and returns the button that opened it. */
  async function openConfirm(): Promise<HTMLButtonElement> {
    loaded();
    await mount();

    const trigger = button("Удалить желание");
    expect(trigger).toBeDefined();
    await press("Удалить желание");
    expect(dialogElement()).not.toBeNull();
    // The dialog opens on «Отмена», not on the trigger behind it.
    expect(document.activeElement).not.toBe(trigger);
    return trigger as HTMLButtonElement;
  }

  it("«Отмена»: фокус на «Удалить желание»", async () => {
    const trigger = await openConfirm();

    await pressExact("Отмена");

    expect(dialogElement()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Esc: фокус на «Удалить желание»", async () => {
    const trigger = await openConfirm();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(dialogElement()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("тап по подложке: фокус на «Удалить желание»", async () => {
    const trigger = await openConfirm();

    await pressScrim("confirm-dialog-scrim");

    expect(dialogElement()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    // Never `<body>`: the layer hands focus back instead of dropping it.
    expect(document.activeElement).not.toBe(document.body);
  });

  it("успешное удаление не возвращает фокус на кнопку: экран уходит к списку", async () => {
    loaded();
    gifts.deleteGift.mockResolvedValue({ ok: true });
    await mount();

    const trigger = button("Удалить желание");
    await press("Удалить желание");
    await pressExact("Удалить");

    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_deleted" },
    });
    expect(dialogElement()).toBeNull();
    expect(document.activeElement).not.toBe(trigger);
  });
});

describe("изменение желания: теги", () => {
  const tagged: GiftCard = {
    ...stored,
    tags: [
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: null, label: "своё" },
    ],
  };
  const catalogue = [
    { id: "tag_dream", slug: "dream", label: "мечта" },
    { id: "tag_need", slug: "need-now", label: "нужно сейчас" },
  ];

  it("показывает сохранённые теги и при неизменной правке не шлёт ключ tags", async () => {
    loaded(tagged);
    tagApi.fetchTagCatalog.mockResolvedValue({ ok: true, tags: catalogue });
    gifts.updateGift.mockResolvedValue({ ok: true, gift: { ...tagged, title: "Наушники Sony" } });
    await mount();

    expect(text()).toContain("мечта");
    expect(text()).toContain("своё");
    expect(
      container
        .querySelector('[role="checkbox"][aria-label="мечта"]')
        ?.getAttribute("aria-checked"),
    ).toBe("true");

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    const body = gifts.updateGift.mock.calls[0]![1] as Record<string, unknown>;
    // Absent tags keep the stored rows; an unchanged set must not rewrite them.
    expect(body).not.toHaveProperty("tags");
  });

  it("удаление всех тегов шлёт явный пустой массив", async () => {
    loaded(tagged);
    tagApi.fetchTagCatalog.mockResolvedValue({ ok: true, tags: catalogue });
    gifts.updateGift.mockResolvedValue({ ok: true, gift: { ...tagged, tags: [] } });
    await mount();

    await pressExact("мечта");
    await pressExact("Убрать тег своё");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    const body = gifts.updateGift.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.tags).toEqual([]);
  });

  it("добавленный фиксированный тег уходит как catalogId вместе с прежними", async () => {
    loaded(tagged);
    tagApi.fetchTagCatalog.mockResolvedValue({ ok: true, tags: catalogue });
    gifts.updateGift.mockResolvedValue({ ok: true, gift: tagged });
    await mount();

    await pressExact("нужно сейчас");
    await press("Сохранить");

    const body = gifts.updateGift.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.tags).toEqual([
      { catalogId: "tag_dream" },
      { text: "своё" },
      { catalogId: "tag_need" },
    ]);
  });

  it("ошибка сервера tags.0.text видна в блоке тегов, форма остаётся", async () => {
    loaded(tagged);
    tagApi.fetchTagCatalog.mockResolvedValue({ ok: true, tags: catalogue });
    gifts.updateGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid tag",
      field: "tags.0.text",
    });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(text()).toContain("Проверьте теги: до 30 символов и без повторов.");
    expect(text()).not.toContain("Не получилось сохранить. Попробуйте ещё раз.");
    // Q-09: the saved order maps N onto the chip; `tags.0` is «мечта», not «своё».
    expect(
      container
        .querySelector('[role="checkbox"][aria-label="мечта"]')
        ?.getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      container
        .querySelector('[role="button"][aria-label="Убрать тег своё"]')
        ?.getAttribute("aria-invalid"),
    ).toBeNull();
    expect(field("Название").value).toBe("Наушники Sony");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("загрузка каталога не скрывает сохранённые фиксированный и свой теги", async () => {
    tagApi.fetchTagCatalog.mockReturnValue(new Promise(() => {}));
    loaded(tagged);
    await mount();

    expect(text()).toContain("Загружаем теги…");
    expect(
      container
        .querySelector('[role="checkbox"][aria-label="мечта"]')
        ?.getAttribute("aria-checked"),
    ).toBe("true");
    expect(text()).toContain("своё");
  });

  /**
   * The catalogue is an optional source of chips, not the source of the saved
   * choice: an error or an empty catalogue must not drop tags from the draft.
   */
  it.each([
    [
      "ошибка сети",
      { ok: false, network: true },
      "Не получилось загрузить теги. Свои теги всё равно можно добавить.",
    ],
    [
      "битый ответ каталога",
      { ok: false, invalid: true },
      "Не получилось загрузить теги. Свои теги всё равно можно добавить.",
    ],
    // An empty catalogue is `ready`: the saved fixed chip still renders, so the
    // empty-state copy is intentionally hidden (2.5.6) and only the loading copy must be gone.
    ["пустой каталог", { ok: true, tags: [] }, null],
  ] as const)("%s не сбрасывает сохранённые теги и не шлёт tags при неизменном наборе", async (_state, catalog, copy) => {
    loaded(tagged);
    tagApi.fetchTagCatalog.mockResolvedValue(catalog);
    gifts.updateGift.mockResolvedValue({ ok: true, gift: tagged });
    await mount();
    await settle(10);

    // The catalogue really left the loading state, so preservation is proven.
    expect(text()).not.toContain("Загружаем теги…");
    if (copy === null) {
      expect(button("Повторить")).toBeUndefined();
    } else {
      expect(text()).toContain(copy);
      expect(button("Повторить")).toBeDefined();
    }
    expect(
      container
        .querySelector('[role="checkbox"][aria-label="мечта"]')
        ?.getAttribute("aria-checked"),
    ).toBe("true");
    expect(text()).toContain("своё");

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    const body = gifts.updateGift.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("tags");
  });

  it("RESERVED: набор тегов меняется, а visibility и quantity остаются вне тела", async () => {
    const reserved: GiftCard = { ...tagged, status: "RESERVED" };
    loaded(reserved);
    tagApi.fetchTagCatalog.mockResolvedValue({ ok: true, tags: catalogue });
    gifts.updateGift.mockResolvedValue({ ok: true, gift: reserved });
    await mount();

    await pressExact("нужно сейчас");
    await press("Сохранить");

    const body = gifts.updateGift.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.tags).toEqual([
      { catalogId: "tag_dream" },
      { text: "своё" },
      { catalogId: "tag_need" },
    ]);
    // No new status restriction for tags; the frozen fields stay omitted.
    expect(body).not.toHaveProperty("visibility");
    expect(body).not.toHaveProperty("quantity");
  });
});

/**
 * `DESIGN.md` → Мышь и клавиатура: the step takes focus on its title when it
 * opens and gives it back to «Отмена» when it closes (`EXPERIENCE.md` → Esc /
 * scrim / системное «назад»).
 */
describe("изменение желания: фокус в вопросе о черновике", () => {
  beforeEach(() => {
    platform.os = "web";
  });

  it("Esc закрывает вопрос и возвращает фокус на «Отмена»", async () => {
    loaded();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await type("Название", "Наушники Sony");
    const cancel = button("Отмена");
    // A mouse press focuses the control before it opens the step.
    await act(async () => cancel?.focus());
    await press("Отмена");

    const dialog = dialogElement();
    expect(dialog).not.toBeNull();
    expect(dialog?.contains(document.activeElement)).toBe(true);

    await escapeDialog();

    expect(document.activeElement).toBe(cancel);
    expect(field("Название").value).toBe("Наушники Sony");
  });

  it("двойной тап «Сохранить» в диалоге шлёт один updateGift", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: true, gift: { ...stored, title: "Наушники Sony" } });
    await mount();

    await type("Название", "Наушники Sony");
    await systemBack();

    const confirm = dialogButton("Сохранить");
    expect(confirm).toBeDefined();
    // Both taps land before the dialog can leave the screen.
    await act(async () => {
      confirm?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      confirm?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
  });
});
