// @vitest-environment happy-dom
import type { Me, NotificationPreferences } from "@gift-list/contracts";
import { breakpoints, spacing } from "@gift-list/ui";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/session/auth-context";
import { controls, dialogElement, settle, typeInto } from "@/test/dom";
import { declarationsFor, findByPaint, paintedSpace, paintedValue } from "@/test/tamagui-css";
import { pageGutter } from "@/ui/card-grid";
import SettingsScreen from "../../app/(app)/settings";

/**
 * W12.16: the settings screen lays itself out with the Tamagui media clause
 * `$page-gutter medium:$page-gutter-lg` instead of `useWindowDimensions` +
 * `pageGutter(width)`. There is no card grid here, so the window width is never
 * read in JS. Widths are checked against the CSS Tamagui actually generated (see
 * `@/test/tamagui-css`), not against a browser layout.
 */

/** The counter proves the screen never asks React Native for the window width. */
const dimensions = vi.hoisted(() => ({ calls: 0 }));

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const me = vi.hoisted(() => ({
  updateHideFromSearch: vi.fn(),
  deleteAccount: vi.fn(),
  changeTimeZone: vi.fn(),
}));
const blocks = vi.hoisted(() => ({ listBlocked: vi.fn(), unblockUser: vi.fn() }));
const notifications = vi.hoisted(() => ({
  fetchNotificationPreferences: vi.fn(),
  saveNotificationPreferences: vi.fn(),
}));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(),
}));

vi.mock("@/api/client", () => api);
vi.mock("@/api/me", () => me);
vi.mock("@/api/block", () => blocks);
vi.mock("@/api/notifications", () => notifications);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
// The confirm dialog draws its close cross with `expo-symbols`, which loads a
// symbol font at runtime; the icon is decorative here.
vi.mock("expo-symbols", async () => {
  const React = await import("react");
  return {
    SymbolView: function SymbolView() {
      return React.createElement("span", { "aria-hidden": true });
    },
  };
});
vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  function useWindowDimensions() {
    dimensions.calls += 1;
    return actual.useWindowDimensions();
  }
  return { ...actual, useWindowDimensions };
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
  const catalogs = {
    app: read("app"),
    common: read("common"),
    notifications: read("notifications"),
  };

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
    const base =
      head === "common"
        ? catalogs.common
        : head === "notifications"
          ? catalogs.notifications
          : catalogs.app;
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
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
    // W12.23: the wide loading state reads the safe area for its window fallback.
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Story 7.2: a short IANA list keeps the picker test fast and the order fixed. */
const ZONES = ["Europe/Minsk", "Asia/Tokyo", "UTC"];

const user: Me = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
  hideFromSearch: false,
};

/** Story 7.2: both reminder types on, as the server defaults them. */
const preferences: NotificationPreferences = {
  datesInApp: true,
  datesEmail: false,
  wishExpiryInApp: false,
  wishExpiryEmail: true,
  remindFriendDates: true,
  remindOwnList: true,
};

type Auth = ReturnType<typeof useAuth>;
const probe: { auth?: Auth } = {};

function Probe({ onAuth }: { onAuth: (value: Auth) => void }) {
  const value = useAuth();
  useEffect(() => {
    onAuth(value);
  });
  return null;
}

let root: Root;
let container: HTMLElement;

/** `/api/v1/me` answers with the session. */
function signedIn(account: Me = user) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? { ok: true, data: account } : { ok: true, data: { signedOut: true } },
    ),
  );
}

function text(): string {
  return container.textContent ?? "";
}

function button(label: string): HTMLElement | undefined {
  return controls(container).find((node) => (node.textContent ?? "").includes(label));
}

async function press(label: string) {
  const target = button(label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Story 4.5: a press by the accessible name, e.g. «Разблокировать: Аня». */
async function pressLabel(label: string) {
  const target = controls(container).find((node) => node.getAttribute("aria-label") === label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/**
 * The dialog is portalled to `document.body`, outside the test container, and
 * exact labels keep «Удалить» apart from the «Удалить аккаунт» row.
 */
function pageButton(label: string): HTMLElement | undefined {
  return controls(document).find((node) => (node.textContent ?? "").trim() === label);
}

async function pressPage(label: string) {
  const target = pageButton(label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** The name and the @nick of a row, as the reader announces them together. */
function blockedRow(nick: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid="blocked-row-${nick}"]`);
}

/** Story 3.5: the one switch of the screen (`role="switch"`). */
function hideSwitch(): HTMLElement {
  const node = container.querySelector<HTMLElement>('[role="switch"]');
  expect(node, "переключатель «Не показывать в поиске»").not.toBeNull();
  return node as HTMLElement;
}

async function flipSwitch() {
  const node = hideSwitch();
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <Probe
          onAuth={(value) => {
            probe.auth = value;
          }}
        />
        <SettingsScreen />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  dimensions.calls = 0;
  delete probe.auth;
  vi.spyOn(Intl as unknown as { supportedValuesOf: (key: string) => string[] }, "supportedValuesOf")
    .mockReturnValue([...ZONES]);
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  navigation.canGoBack.mockReturnValue(false);
  blocks.listBlocked.mockResolvedValue({
    ok: true,
    page: { items: [], nextCursor: null, total: 0 },
  });
  notifications.fetchNotificationPreferences.mockResolvedValue(preferences);
  notifications.saveNotificationPreferences.mockResolvedValue({
    success: true,
    data: preferences,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("настройки: гейт сессии", () => {
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

  it("аноним уходит на вход с возвратом в настройки", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/settings" },
    });
    // Until the redirect lands the page still says «Загружаем», not blank.
    expect(container.querySelector('[data-testid="session-loading"]')).not.toBeNull();
  });

  it("обрыв сети при проверке сессии: экран ошибки с «Повторить», без входа", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="session-error"]')).not.toBeNull();
    expect(text()).toContain("Нет связи с сервером");

    signedIn();
    await press("Повторить");
    expect(api.apiRequest.mock.calls.filter(([path]) => path === "/api/v1/me").length).toBe(2);
    expect(hideSwitch()).not.toBeNull();
  });
});

describe("настройки: только настройки", () => {
  it("ника и кнопки сохранения имени здесь больше нет (D-59)", async () => {
    signedIn();
    await mount();

    expect(text()).not.toContain("Ник");
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(button("Сохранить")).toBeUndefined();
    // The real settings stay: the search switch and the blocked section.
    expect(hideSwitch()).not.toBeNull();
    expect(text()).toContain("Заблокированные");
  });
});

describe("настройки: аккаунт (Story 6.3, D-59)", () => {
  it("внизу «Аккаунт»: «Выйти» и destructive «Удалить аккаунт»", async () => {
    signedIn();
    await mount();

    const section = container.querySelector<HTMLElement>('[data-testid="account-section"]');
    expect(section).not.toBeNull();
    expect(section?.textContent).toContain("Аккаунт");
    expect(
      container.querySelector<HTMLElement>('[data-testid="settings-sign-out"]')?.textContent,
    ).toBe("Выйти");
    expect(
      container.querySelector<HTMLElement>('[data-testid="settings-delete-account"]')
        ?.textContent,
    ).toBe("Удалить аккаунт");
  });

  it("«Выйти» завершает сессию и уводит на вход с возвратом в настройки", async () => {
    signedIn();
    await mount();

    await press("Выйти");

    expect(api.apiRequest).toHaveBeenLastCalledWith("/api/v1/session", { method: "DELETE" });
    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(probe.auth?.state).toEqual({ status: "anonymous" });
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/settings" },
    });
  });

  it("«Удалить аккаунт» спрашивает подтверждение с именем и предупреждает о потере", async () => {
    signedIn();
    await mount();

    await press("Удалить аккаунт");
    await settle();

    const dialog = dialogElement();
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Удалить аккаунт «Аня»?");
    expect(dialog?.textContent).toContain(
      "Вишлист, желания, друзья, брони и подписки удалятся навсегда. Отменить это нельзя.",
    );
    expect(pageButton("Отмена")).toBeDefined();
    expect(pageButton("Удалить")).toBeDefined();
    expect(me.deleteAccount).not.toHaveBeenCalled();
  });

  it("«Отмена» закрывает подтверждение и ничего не удаляет", async () => {
    signedIn();
    await mount();

    await press("Удалить аккаунт");
    await settle();
    await pressPage("Отмена");
    await settle(300);

    expect(me.deleteAccount).not.toHaveBeenCalled();
    expect(dialogElement()).toBeNull();
    expect(probe.auth?.state).toEqual({ status: "ready", user });
  });

  it("успех: один запрос, локальная сессия погашена, вход с тостом «Аккаунт удалён»", async () => {
    signedIn();
    me.deleteAccount.mockResolvedValue({ ok: true });
    await mount();

    await press("Удалить аккаунт");
    await settle();
    await pressPage("Удалить");
    await settle();

    expect(me.deleteAccount).toHaveBeenCalledTimes(1);
    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(probe.auth?.state).toEqual({ status: "anonymous" });
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { reason: "account_deleted" },
    });
  });

  it("во время запроса «Удалить» занята и второй тап не шлёт второй запрос", async () => {
    signedIn();
    me.deleteAccount.mockReturnValue(new Promise(() => {}));
    await mount();

    await press("Удалить аккаунт");
    await settle();
    await pressPage("Удалить");

    expect(me.deleteAccount).toHaveBeenCalledTimes(1);
    expect(dialogElement()?.textContent).toContain("Удаляем…");
    expect(pageButton("Удаляем…")?.getAttribute("aria-disabled")).toBe("true");

    await pressPage("Удаляем…");
    expect(me.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("сеть: тост, аккаунт и сессия на месте — можно повторить", async () => {
    signedIn();
    me.deleteAccount.mockResolvedValue({ ok: false, network: true });
    await mount();

    await press("Удалить аккаунт");
    await settle();
    await pressPage("Удалить");
    await settle();

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(probe.auth?.state).toEqual({ status: "ready", user });
    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("409 (удаление идёт) — понятный тост ошибки, ничего не потеряно", async () => {
    signedIn();
    me.deleteAccount.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "Account deletion is in progress, retry",
    });
    await mount();

    await press("Удалить аккаунт");
    await settle();
    await pressPage("Удалить");
    await settle();

    expect(text()).toContain("Не получилось удалить аккаунт. Попробуйте ещё раз.");
    expect(probe.auth?.state).toEqual({ status: "ready", user });
    expect(store.clearSessionToken).not.toHaveBeenCalled();
  });

  it("401 при удалении: сессия закончилась, вход с возвратом в настройки", async () => {
    signedIn();
    me.deleteAccount.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    await mount();

    await press("Удалить аккаунт");
    await settle();
    await pressPage("Удалить");
    await settle();

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/settings", reason: "session_expired" },
    });
  });
});

describe("настройки: скрыть из поиска", () => {
  it("выключен по умолчанию; включение сразу шлёт PATCH и обновляет контекст", async () => {
    signedIn();
    const hidden = { ...user, hideFromSearch: true };
    me.updateHideFromSearch.mockResolvedValue({ ok: true, data: hidden });
    await mount();

    const node = hideSwitch();
    expect(node.getAttribute("aria-checked")).toBe("false");
    expect(text()).toContain("Не показывать в поиске");
    expect(text()).toContain("Прямые ссылки на профиль и вишлист по-прежнему работают.");

    await flipSwitch();

    expect(me.updateHideFromSearch).toHaveBeenCalledWith(true);
    expect(hideSwitch().getAttribute("aria-checked")).toBe("true");
    expect(probe.auth?.state).toEqual({ status: "ready", user: hidden });
  });

  it("исходное true приходит с /me; выключение шлёт false", async () => {
    signedIn({ ...user, hideFromSearch: true });
    const visible = { ...user, hideFromSearch: false };
    me.updateHideFromSearch.mockResolvedValue({ ok: true, data: visible });
    await mount();

    expect(hideSwitch().getAttribute("aria-checked")).toBe("true");

    await flipSwitch();

    expect(me.updateHideFromSearch).toHaveBeenCalledWith(false);
    expect(hideSwitch().getAttribute("aria-checked")).toBe("false");
    expect(probe.auth?.state).toEqual({ status: "ready", user: visible });
  });

  it("пока PATCH идёт, переключатель недоступен и второй тап не шлёт второй запрос", async () => {
    signedIn();
    me.updateHideFromSearch.mockReturnValue(new Promise(() => {}));
    await mount();

    await flipSwitch();

    expect(me.updateHideFromSearch).toHaveBeenCalledTimes(1);
    expect(hideSwitch().getAttribute("aria-disabled")).toBe("true");

    await act(async () => {
      hideSwitch().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(me.updateHideFromSearch).toHaveBeenCalledTimes(1);
  });

  it("обрыв сети: флаг откатывается и показан тост", async () => {
    signedIn();
    me.updateHideFromSearch.mockResolvedValue({ ok: false, network: true });
    await mount();

    await flipSwitch();

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(hideSwitch().getAttribute("aria-checked")).toBe("false");
    expect(probe.auth?.state).toEqual({ status: "ready", user });
  });

  it("401: сессия закончилась, вход с возвратом в настройки", async () => {
    signedIn();
    me.updateHideFromSearch.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    await mount();

    await flipSwitch();

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/settings", reason: "session_expired" },
    });
  });
});

describe("настройки: напоминания (Story 7.2)", () => {
  /** A switch of the reminders block, found by its visible (accessible) label. */
  function switchNode(label: string): HTMLElement | null {
    return container.querySelector<HTMLElement>(`[role="switch"][aria-label="${label}"]`);
  }

  async function flipSwitch(label: string) {
    const node = switchNode(label);
    expect(node, `переключатель «${label}»`).not.toBeNull();
    await act(async () => {
      node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);
  }

  it("блок «Напоминания»: оба переключателя включены по умолчанию", async () => {
    signedIn();
    await mount();
    await settle(10);

    expect(text()).toContain("Напоминания");
    expect(switchNode("Дни рождения и даты друзей")?.getAttribute("aria-checked")).toBe("true");
    expect(switchNode("Напомнить обновить мой список")?.getAttribute("aria-checked")).toBe("true");
  });

  it("выключение сразу шлёт PATCH только своего ключа и берёт ответ сервера", async () => {
    signedIn();
    const saved = { ...preferences, remindFriendDates: false };
    notifications.saveNotificationPreferences.mockResolvedValue({ ok: true, data: saved });
    await mount();
    await settle(10);

    await flipSwitch("Дни рождения и даты друзей");

    expect(notifications.saveNotificationPreferences).toHaveBeenCalledWith({
      remindFriendDates: false,
    });
    expect(switchNode("Дни рождения и даты друзей")?.getAttribute("aria-checked")).toBe("false");
    expect(switchNode("Напомнить обновить мой список")?.getAttribute("aria-checked")).toBe("true");
  });

  it("ошибка: переключатель откатывается и приходит тост", async () => {
    signedIn();
    notifications.saveNotificationPreferences.mockResolvedValue({ ok: false, network: false });
    await mount();
    await settle(10);

    await flipSwitch("Напомнить обновить мой список");

    expect(notifications.saveNotificationPreferences).toHaveBeenCalledWith({
      remindOwnList: false,
    });
    expect(switchNode("Напомнить обновить мой список")?.getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("Не удалось сохранить настройки уведомлений");
  });

  it("без сети переключатель откатывается и тост говорит о потере сети", async () => {
    signedIn();
    notifications.saveNotificationPreferences.mockResolvedValue({ ok: false, network: true });
    await mount();
    await settle(10);

    await flipSwitch("Дни рождения и даты друзей");

    expect(switchNode("Дни рождения и даты друзей")?.getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(text()).not.toContain("Не удалось сохранить настройки уведомлений");
  });

  it("пока PATCH идёт, второй тап не шлёт второй запрос", async () => {
    signedIn();
    notifications.saveNotificationPreferences.mockReturnValue(new Promise(() => {}));
    await mount();
    await settle(10);

    await flipSwitch("Дни рождения и даты друзей");
    await flipSwitch("Напомнить обновить мой список");

    expect(notifications.saveNotificationPreferences).toHaveBeenCalledTimes(1);
  });
});

describe("настройки: часовой пояс (Story 7.2)", () => {
  /** The opener of the zone picker: «Часовой пояс: Europe/Minsk (UTC+3)». */
  function zoneButton(): HTMLElement | undefined {
    return controls(container).find((node) =>
      (node.getAttribute("aria-label") ?? "").startsWith("Часовой пояс:"),
    );
  }

  async function openZonePicker(): Promise<HTMLElement> {
    const opener = zoneButton();
    expect(opener, "поле «Часовой пояс»").toBeDefined();
    await act(async () => {
      opener?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);
    const layer = dialogElement();
    expect(layer, "слой выбора пояса").not.toBeNull();
    return layer as HTMLElement;
  }

  it("строка показывает сохранённый пояс и смещение UTC", async () => {
    signedIn();
    await mount();

    expect(container.querySelector('[data-testid="time-zone-section"]')).not.toBeNull();
    expect(zoneButton()?.getAttribute("aria-label")).toBe(
      "Часовой пояс: Europe/Minsk (UTC+3)",
    );
  });

  it("выбор из списка с поиском сохраняет пояс, обновляет сессию и показывает тост", async () => {
    signedIn();
    me.changeTimeZone.mockResolvedValue({ ok: true, timeZone: "Asia/Tokyo" });
    await mount();

    const layer = await openZonePicker();
    const search = layer.querySelector<HTMLInputElement>("input");
    expect(search, "поле поиска пояса").not.toBeNull();
    await typeInto(search as HTMLInputElement, "Tokyo");

    const option = Array.from(layer.querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (node) => (node.textContent ?? "").trim() === "Asia/Tokyo (UTC+9)",
    );
    expect(option, "вариант «Asia/Tokyo»").toBeDefined();
    await act(async () => {
      option?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(me.changeTimeZone).toHaveBeenCalledWith("Asia/Tokyo");
    expect(probe.auth?.state).toEqual({
      status: "ready",
      user: { ...user, timeZone: "Asia/Tokyo" },
    });
    expect(zoneButton()?.getAttribute("aria-label")).toBe("Часовой пояс: Asia/Tokyo (UTC+9)");
    expect(text()).toContain("Часовой пояс изменён.");
  });

  it("ошибка сети: пояс остаётся прежним и приходит тост", async () => {
    signedIn();
    me.changeTimeZone.mockResolvedValue({ ok: false, network: true });
    await mount();

    const layer = await openZonePicker();
    const search = layer.querySelector<HTMLInputElement>("input");
    expect(search, "поле поиска пояса").not.toBeNull();
    await typeInto(search as HTMLInputElement, "Tokyo");
    const option = Array.from(layer.querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (node) => (node.textContent ?? "").trim() === "Asia/Tokyo (UTC+9)",
    );
    await act(async () => {
      option?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(zoneButton()?.getAttribute("aria-label")).toBe(
      "Часовой пояс: Europe/Minsk (UTC+3)",
    );
    expect(probe.auth?.state).toEqual({ status: "ready", user });
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
  });
});

describe("настройки: заблокированные", () => {
  /** `/me/blocks` answers with these rows; `nextCursor` is the opaque page cursor. */
  function blockedServer(
    items: { displayName: string; nick: string }[],
    nextCursor: string | null = null,
  ) {
    blocks.listBlocked.mockResolvedValue({
      ok: true,
      page: { items, nextCursor, total: items.length },
    });
  }

  it("список: имя, @ник и «Разблокировать», без меню ⋮", async () => {
    signedIn();
    blockedServer([
      { displayName: "Аня", nick: "anya" },
      { displayName: "Борис", nick: "boris" },
    ]);
    await mount();

    const headings = Array.from(container.querySelectorAll("[role='heading']"));
    const section = headings.find((node) => node.getAttribute("aria-level") === "2");
    expect(section?.textContent).toBe("Заблокированные");
    expect(blockedRow("anya")?.textContent).toContain("Аня");
    expect(blockedRow("anya")?.textContent).toContain("@anya");
    expect(blockedRow("boris")?.textContent).toContain("@boris");
    expect(container.querySelector('[aria-label^="Действия"]')).toBeNull();
    expect(
      controls(container).filter(
        (node) => node.getAttribute("aria-label") === "Разблокировать: Аня",
      ),
    ).toHaveLength(1);
  });

  it("пусто: «Вы никого не блокировали»", async () => {
    signedIn();
    await mount();

    expect(text()).toContain("Вы никого не блокировали");
    expect(container.querySelector('[data-testid="blocked-row-skeleton"]')).toBeNull();
  });

  it("разблокировать: строка исчезает сразу и приходит тост", async () => {
    signedIn();
    blockedServer([
      { displayName: "Аня", nick: "anya" },
      { displayName: "Борис", nick: "boris" },
    ]);
    blocks.unblockUser.mockResolvedValue({ ok: true, outcome: "UNBLOCKED" });
    await mount();

    await pressLabel("Разблокировать: Аня");

    expect(blocks.unblockUser).toHaveBeenCalledWith("anya");
    expect(blockedRow("anya")).toBeNull();
    expect(blockedRow("boris")).not.toBeNull();
    expect(text()).toContain("Аня разблокирован");
  });

  it("ошибка сети откатывает строку и показывает тост", async () => {
    signedIn();
    blockedServer([{ displayName: "Аня", nick: "anya" }]);
    blocks.unblockUser.mockResolvedValue({ ok: false, network: true });
    await mount();

    await pressLabel("Разблокировать: Аня");

    expect(blocks.unblockUser).toHaveBeenCalledTimes(1);
    expect(blockedRow("anya")).not.toBeNull();
    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
  });

  it("повторная загрузка берёт список с сервера и не возвращает разблокированного", async () => {
    signedIn();
    blockedServer([
      { displayName: "Аня", nick: "anya" },
      { displayName: "Борис", nick: "boris" },
    ]);
    blocks.unblockUser.mockResolvedValue({ ok: true, outcome: "UNBLOCKED" });
    await mount();

    await pressLabel("Разблокировать: Аня");
    expect(blockedRow("anya")).toBeNull();

    // The server no longer lists Аня; a fresh screen reads the list again.
    blockedServer([{ displayName: "Борис", nick: "boris" }]);
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();

    expect(blocks.listBlocked).toHaveBeenCalledTimes(2);
    expect(blockedRow("anya")).toBeNull();
    expect(text()).not.toContain("Аня");
    expect(blockedRow("boris")).not.toBeNull();
  });

  it("ошибка загрузки: текст и «Повторить» перезагружают список", async () => {
    signedIn();
    blocks.listBlocked.mockResolvedValue({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");

    blockedServer([{ displayName: "Аня", nick: "anya" }]);
    await press("Повторить");

    expect(blocks.listBlocked).toHaveBeenCalledTimes(2);
    expect(blockedRow("anya")).not.toBeNull();
  });

  it("«Показать ещё» добавляет следующую страницу по курсору", async () => {
    signedIn();
    blocks.listBlocked.mockResolvedValueOnce({
      ok: true,
      page: { items: [{ displayName: "Аня", nick: "anya" }], nextCursor: "c1", total: 2 },
    });
    blocks.listBlocked.mockResolvedValueOnce({
      ok: true,
      page: { items: [{ displayName: "Борис", nick: "boris" }], nextCursor: null, total: 2 },
    });
    await mount();

    await press("Показать ещё");

    expect(blocks.listBlocked).toHaveBeenLastCalledWith("c1");
    expect(blockedRow("anya")).not.toBeNull();
    expect(blockedRow("boris")).not.toBeNull();
    expect(button("Показать ещё")).toBeUndefined();
  });

  it("401 при разблокировке: сессия закончилась, вход с возвратом в настройки", async () => {
    signedIn();
    blockedServer([{ displayName: "Аня", nick: "anya" }]);
    blocks.unblockUser.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    await mount();

    await pressLabel("Разблокировать: Аня");

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/settings", reason: "session_expired" },
    });
  });
});

describe("настройки: назад", () => {
  it("с историей возвращает назад", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(true);
    await mount();

    await press("Назад");

    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("без истории заменяет экран вишлистом", async () => {
    signedIn();
    navigation.canGoBack.mockReturnValue(false);
    await mount();

    await press("Назад");

    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith("/");
  });
});

/** The one `GLColumn` of the page: the column whose padding is the page gutter. */
function column(): HTMLElement {
  const node = container.querySelector<HTMLElement>('[name="GLColumn"]');
  expect(node, "колонка страницы").not.toBeNull();
  return node as HTMLElement;
}

/**
 * Mounts the settings screen only once the session is ready. The shared loading
 * skeleton is a screen of its own (W12.15) and still reads the window width, so it
 * must be out of the tree when the width counter is read.
 */
async function mountReady() {
  function SignedIn() {
    const auth = useAuth();
    return auth.state.status === "ready" ? <SettingsScreen /> : null;
  }
  await act(async () => {
    root.render(
      <AuthProvider>
        <SignedIn />
      </AuthProvider>,
    );
  });
}

describe("W12.16: настройки на медиа-пропсах", () => {
  it("ширина окна из JS не читается", async () => {
    signedIn();
    await mountReady();

    expect(container.querySelector('[data-testid="session-loading"]')).toBeNull();
    expect(dimensions.calls).toBe(0);
  });

  it("счётчик видит экран, который ширину читает (контроль)", async () => {
    // A probe through the same import the screen used to call: a zero above means
    // the mock is in place, not that the spy is broken.
    const { useWindowDimensions } = await import("react-native");
    function Probe() {
      useWindowDimensions();
      return null;
    }
    await act(async () => root.render(<Probe />));

    expect(dimensions.calls).toBeGreaterThan(0);
  });

  it.each([360, 600, 1024, 1280])("ширина %ipx: отступ как у pageGutter", async (width) => {
    signedIn();
    await mountReady();

    expect(paintedSpace(column(), "padding-inline", width)).toBe(pageGutter(width));
  });

  it("граница одна и та же: 16 до bp-medium, 24 от bp-medium", async () => {
    signedIn();
    await mountReady();
    const element = column();

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
    signedIn();
    await mountReady();
    const gutterRules = declarationsFor(column(), "padding-inline");

    expect(gutterRules).toHaveLength(2);
    const conditions = gutterRules.map((rule) => rule.minWidth);
    expect(conditions).toContain(null);
    expect(conditions).toContain(breakpoints.medium);
  });

  it("экран настроек отрисован: заголовок и переключатель на месте", async () => {
    signedIn();
    await mountReady();

    expect(container.querySelector('[data-testid="settings-page"]')).not.toBeNull();
    const heading = container.querySelector("[role='heading']");
    expect(heading?.getAttribute("aria-level")).toBe("1");
    expect(heading?.textContent).toBe("Настройки");
    expect(hideSwitch()).not.toBeNull();
    expect(container.querySelector('[data-testid="page-footer"]')).not.toBeNull();
  });

  it("отступы контента — токены $2/$section-gap с прежними px", async () => {
    signedIn();
    await mountReady();
    const body = findByPaint(container, "padding-top", "2");

    expect(body, "контент настроек").toBeDefined();
    expect(paintedValue(body as Element, "padding-top", 360)).toBe("var(--t-space-2)");
    expect(paintedSpace(body as Element, "padding-top", 360)).toBe(spacing["grid-gap"] / 2);
    expect(paintedSpace(body as Element, "padding-bottom", 360)).toBe(spacing["section-gap"]);
  });
});
