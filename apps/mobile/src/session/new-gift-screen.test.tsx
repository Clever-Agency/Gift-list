// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, dialogElement, escape, settle, typeInto } from "@/test/dom";
import NewGiftScreen from "../../app/(app)/gifts/new";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const gifts = vi.hoisted(() => ({ createGift: vi.fn() }));
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

vi.mock("@/api/client", () => api);
// The screen under test is the create flow only: the api module's own mapping is
// covered by its callers, so the screen test drives `createGift` directly.
vi.mock("@/api/my-gifts", () => gifts);
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

const created: GiftCard = {
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

async function press(label: string) {
  const target = button(label);
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
        <NewGiftScreen />
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

/**
 * `/gifts/new` opened from the list in the browser: the form's entry sits on top
 * of the list's. The guard's own copy is pushed on top when the form turns dirty.
 */
function listThenForm() {
  platform.os = "web";
  window.history.replaceState({ id: "list" }, "", "/");
  window.history.pushState({ id: "form" }, "", "/gifts/new");
}

beforeEach(() => {
  vi.resetAllMocks();
  guard.reset();
  platform.os = "android";
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
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

describe("новое желание: гейт сессии", () => {
  it("пока сессия неизвестна, ничего не показывает и не уходит со страницы", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toBe("");
  });

  it("аноним уходит на вход с возвратом в форму", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/new" },
    });
    expect(text()).toBe("");
  });
});

describe("новое желание: форма", () => {
  it("рисует заголовок, поля и кнопку создания", async () => {
    signedIn();
    await mount();

    expect(text()).toContain("Новое желание");
    expect(text()).toContain("Название");
    expect(text()).toContain("Кто видит");
    expect(button("Добавить желание")).toBeDefined();
  });

  it("успех: шлёт GiftInput и уводит к списку с одноразовым параметром toast", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });
    await mount();

    await type("Название", "Наушники");
    await type("Цена (необязательно)", "250");
    await press("Добавить желание");

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
    expect(gifts.createGift).toHaveBeenCalledWith({
      title: "Наушники",
      description: null,
      linkUrl: null,
      priceAmount: 25000,
      priceCurrency: "USD",
      visibility: "PUBLIC",
    });
    // The screen unmounts on the way back, so the confirmation is the list's to show.
    expect(text()).not.toContain("Добавлено в вишлист");
    expect(navigation.dismissTo).toHaveBeenCalledTimes(1);
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_created" },
    });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("пустое название: createGift не зовётся и ухода к списку нет", async () => {
    signedIn();
    await mount();

    await press("Добавить желание");

    // The form owns the rule; the screen must not reach the API without a title.
    expect(gifts.createGift).not.toHaveBeenCalled();
    expect(fieldText("Название")).toContain("Напишите, что вы хотите.");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("VALIDATION: ошибка появляется у поля, форма остаётся с введённым", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(fieldText("Название")).toContain("Напишите, что вы хотите.");
    expect(field("Название").value).toBe("Наушники");
    expect(text()).not.toContain("Не получилось. Попробуйте ещё раз.");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("401: гасит сессию и уводит на вход с возвратом в форму и причиной", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/new", reason: "session_expired" },
    });
  });

  it("обрыв сети: toast и форма с прежними значениями", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Название").value).toBe("Наушники");
    expect(button("Добавить желание")).toBeDefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("ответ не по контракту: общий toast и форма на месте", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: false, invalid: true });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(text()).toContain("Не получилось. Попробуйте ещё раз.");
    expect(field("Название").value).toBe("Наушники");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("пока запрос идёт, кнопка недоступна и второй тап не шлёт второй запрос", async () => {
    signedIn();
    gifts.createGift.mockReturnValue(new Promise(() => {}));
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    const submit = button("Добавить желание");
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect(submit?.getAttribute("aria-disabled")).toBe("true");
    expect(gifts.createGift).toHaveBeenCalledTimes(1);

    await act(async () => {
      submit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(gifts.createGift).toHaveBeenCalledTimes(1);
  });
});

describe("новое желание: отмена", () => {
  it("чистая форма: сразу назад, без вопроса", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await press("Отмена");

    expect(guard.dispatched()).toEqual([{ type: "GO_BACK" }]);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("чистая форма без истории: уводит к списку", async () => {
    signedIn();
    await mount();

    await press("Отмена");

    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).toHaveBeenCalledWith({ pathname: "/" });
    expect(guard.dispatched()).toEqual([{ type: "POP_TO", payload: { pathname: "/" } }]);
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("после правки отмена спрашивает и не уводит", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await type("Название", "Наушники");
    await press("Отмена");

    expect(text()).toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники");
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("крестик «Закрыть» прячет вопрос и оставляет введённое", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await type("Название", "Наушники");
    await press("Отмена");
    await pressInDialogLabeled("Закрыть");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники");
    expect(button("Добавить желание")).toBeDefined();
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("«Не сохранять» уводит назад и не спрашивает снова", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await type("Название", "Наушники");
    await press("Отмена");
    // The navigator still holds the guarded registration of the last render: the
    // dialog's answer must not be stopped by it a second time.
    expect(guard.enabled()).toBe(true);
    await pressInDialog("Не сохранять");

    expect(guard.dispatched()).toEqual([{ type: "GO_BACK" }]);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(text()).not.toContain("Сохранить изменения?");
    expect(gifts.createGift).not.toHaveBeenCalled();
  });

  it("«Не сохранять» без истории уводит к списку и не спрашивает снова", async () => {
    signedIn();
    await mount();

    await type("Название", "Наушники");
    await press("Отмена");
    expect(guard.enabled()).toBe(true);
    await pressInDialog("Не сохранять");

    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).toHaveBeenCalledWith({ pathname: "/" });
    expect(guard.dispatched()).toEqual([{ type: "POP_TO", payload: { pathname: "/" } }]);
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("пока запрос идёт, отмена не спрашивает и не уводит", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(true);
    gifts.createGift.mockReturnValue(new Promise(() => {}));
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");
    await press("Отмена");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("сохранение уводит к списку с toast и без вопроса", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(true);
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_created" },
    });
    // The saved draft leaves without a question, whatever the guard last saw.
    expect(guard.dispatched()).toEqual([
      { type: "POP_TO", payload: { pathname: "/", params: { toast: "gift_created" } } },
    ]);
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("истёкшая сессия уводит на вход, не спрашивая о черновике", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(true);
    gifts.createGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/new", reason: "session_expired" },
    });
    // The hand-over is our own exit: it goes through, it does not ask.
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("истёкшая сессия без связи: вход не открылся, черновик снова под защитой", async () => {
    signOutFails();
    gifts.createGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(navigation.replace).not.toHaveBeenCalled();
    // The hand-over never happened, so the form must ask about the draft again.
    expect(guard.enabled()).toBe(true);
    await systemBack();
    expect(text()).toContain("Сохранить изменения?");
    expect(guard.dispatched()).toEqual([]);
  });
});

describe("новое желание: системное «назад»", () => {
  it("чистая форма: возврат не перехватывается", async () => {
    signedIn();
    await mount();

    expect(guard.enabled()).toBe(false);
  });

  it("после правки возврат спрашивает и не уводит", async () => {
    signedIn();
    await mount();

    await type("Название", "Наушники");
    expect(guard.enabled()).toBe(true);

    await systemBack();

    expect(text()).toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники");
    expect(guard.dispatched()).toEqual([]);
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("«Не сохранять» повторяет ровно тот переход, что просил навигатор", async () => {
    signedIn();
    await mount();

    await type("Название", "Наушники");
    await systemBack();
    await pressInDialog("Не сохранять");

    expect(guard.dispatched()).toEqual([goBack]);
    // The action is the way out: the screen does not pick another one.
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(gifts.createGift).not.toHaveBeenCalled();
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("крестик «Закрыть» не повторяет переход и оставляет введённое", async () => {
    signedIn();
    await mount();

    await type("Название", "Наушники");
    await systemBack();
    await pressInDialogLabeled("Закрыть");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники");
    expect(guard.dispatched()).toEqual([]);
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("Esc возвращает к форме, не повторяя переход", async () => {
    signedIn();
    await mount();

    await type("Название", "Наушники");
    await systemBack();
    await escapeDialog();

    expect(text()).not.toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники");
    expect(guard.dispatched()).toEqual([]);
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("«Сохранить» сохраняет, уводит к списку с toast и не повторяет заблокированный переход", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });
    await mount();

    await type("Название", "Наушники");
    await systemBack();
    await pressInDialog("Сохранить");

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
    expect(gifts.createGift).toHaveBeenCalledWith({
      title: "Наушники",
      description: null,
      linkUrl: null,
      priceAmount: null,
      priceCurrency: null,
      visibility: "PUBLIC",
    });
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_created" },
    });
    // The save has its own way out; the blocked back action is dropped.
    expect(guard.dispatched()).toEqual([
      { type: "POP_TO", payload: { pathname: "/", params: { toast: "gift_created" } } },
    ]);
    expect(navigation.back).not.toHaveBeenCalled();
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("«Сохранить» с ошибкой проверки закрывает диалог и оставляет форму с ошибкой", async () => {
    signedIn();
    await mount();

    // The description makes the draft dirty while the title stays empty.
    await type("Описание (необязательно)", "Подарок");
    await press("Отмена");
    await pressInDialog("Сохранить");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(fieldText("Название")).toContain("Напишите, что вы хотите.");
    expect(field("Описание (необязательно)").value).toBe("Подарок");
    expect(gifts.createGift).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("«Сохранить» с ошибкой сервера закрывает диалог и оставляет форму открытой", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("Название", "Наушники");
    await systemBack();
    await pressInDialog("Сохранить");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Название").value).toBe("Наушники");
    expect(button("Добавить желание")).toBeDefined();
    expect(guard.dispatched()).toEqual([]);
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("пока сохранение идёт, возврат не перехватывается", async () => {
    signedIn();
    gifts.createGift.mockReturnValue(new Promise(() => {}));
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(guard.enabled()).toBe(false);
  });
});

/**
 * Story 2.2 on the web (`EXPERIENCE.md` → Esc / scrim / системное «назад»):
 * `usePreventRemove` never sees the browser's Back, because the URL changes
 * before the navigator is told, so the guard keeps the page on the form itself.
 * These tests drive `window.history` as the browser does and check what the user
 * ends up with: the question, the draft, the address bar.
 */
describe("новое желание: кнопка «назад» браузера", () => {
  it("после правки возврат браузера спрашивает и остаётся на форме", async () => {
    signedIn();
    listThenForm();
    await mount();
    await type("Название", "Наушники");

    await browserBack();

    expect(text()).toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники");
    // The address bar still shows the form: the draft is not thrown away.
    expect(window.location.pathname).toBe("/gifts/new");
    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("«Не сохранять» после возврата браузера уводит на предыдущую страницу", async () => {
    signedIn();
    listThenForm();
    await mount();
    await type("Название", "Наушники");
    await browserBack();

    await pressInDialog("Не сохранять");

    expect(window.location.pathname).toBe("/");
    expect(text()).not.toContain("Сохранить изменения?");
    // The way out is the browser's own Back replayed, not a second navigation.
    expect(guard.dispatched()).toEqual([]);
    expect(gifts.createGift).not.toHaveBeenCalled();
  });

  it("крестик оставляет форму с черновиком, второй возврат снова спрашивает", async () => {    signedIn();
    listThenForm();
    await mount();
    await type("Название", "Наушники");
    await browserBack();

    await pressInDialogLabeled("Закрыть");

    expect(text()).not.toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники");
    expect(window.location.pathname).toBe("/gifts/new");

    await browserBack();

    // The entry the guard keeps on the page is still there for the next Back.
    expect(text()).toContain("Сохранить изменения?");
    expect(field("Название").value).toBe("Наушники");
    expect(window.location.pathname).toBe("/gifts/new");
  });

  it("«Сохранить» после возврата браузера сохраняет и не повторяет возврат", async () => {
    signedIn();
    listThenForm();
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });
    await mount();
    await type("Название", "Наушники");
    await browserBack();

    await pressInDialog("Сохранить");

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_created" },
    });
    // The blocked Back is dropped: the save's own way out is the only navigation.
    expect(guard.dispatched()).toEqual([
      { type: "POP_TO", payload: { pathname: "/", params: { toast: "gift_created" } } },
    ]);
    expect(text()).not.toContain("Сохранить изменения?");
  });

  it("«Не сохранять» после закрытого «Отменой» вопроса уводит без повторного вопроса", async () => {
    signedIn();
    listThenForm();
    await mount();
    await type("Название", "Наушники");

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
    expect(field("Название").value).toBe("Наушники");
    expect(gifts.createGift).not.toHaveBeenCalled();
  });

  it("чистая форма: возврат браузера уходит на список без вопроса", async () => {
    signedIn();
    listThenForm();
    const entries = window.history.length;
    await mount();

    // Nothing to protect: the guard added no entry of its own.
    expect(window.history.length).toBe(entries);

    await browserBack();

    expect(text()).not.toContain("Сохранить изменения?");
    expect(window.location.pathname).toBe("/");
  });
});

/**
 * `DESIGN.md` → Мышь и клавиатура: the step takes focus on its title when it
 * opens and gives it back to «Отмена» when it closes (`EXPERIENCE.md` → Esc /
 * scrim / системное «назад»).
 */
describe("новое желание: фокус в вопросе о черновике", () => {
  // The layer moves DOM focus on the web; on a phone `Modal` owns it.
  beforeEach(() => {
    platform.os = "web";
  });

  it("открытие уводит фокус в диалог, крестик возвращает его на «Отмена»", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await type("Название", "Наушники");
    const cancel = button("Отмена");
    // A mouse press focuses the control before it opens the step.
    await act(async () => cancel?.focus());
    await press("Отмена");

    const dialog = dialogElement();
    expect(dialog).not.toBeNull();
    expect(dialog?.contains(document.activeElement)).toBe(true);

    await pressInDialogLabeled("Закрыть");

    expect(document.activeElement).toBe(cancel);
    expect(field("Название").value).toBe("Наушники");
  });

  it("двойной тап «Сохранить» в диалоге шлёт один createGift", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });
    await mount();

    await type("Название", "Наушники");
    await systemBack();

    const confirm = dialogButton("Сохранить");
    expect(confirm).toBeDefined();
    // Both taps land before the dialog can leave the screen.
    await act(async () => {
      confirm?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      confirm?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
  });
});
