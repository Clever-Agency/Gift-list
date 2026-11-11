// @vitest-environment happy-dom
import type { Me } from "@gift-list/contracts";
import { breakpoints, spacing } from "@gift-list/ui";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/session/auth-context";
import { controls } from "@/test/dom";
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
const me = vi.hoisted(() => ({ updateNick: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(),
}));
/** UI5: happy-dom has no layout, so the scroll call is the observable effect. */
const scrollIntoView = vi.hoisted(() => vi.fn());

vi.mock("@/api/client", () => api);
vi.mock("@/api/me", () => me);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
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

const user: Me = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
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
function signedIn() {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? { ok: true, data: user } : { ok: true, data: { signedOut: true } },
    ),
  );
}

function text(): string {
  return container.textContent ?? "";
}

function field(label: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll("input")).find(
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
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
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
  scrollIntoView.mockClear();
  dimensions.calls = 0;
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  delete probe.auth;
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  navigation.canGoBack.mockReturnValue(false);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
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
    expect(field("Ник").value).toBe("anya");
  });
});

describe("настройки: ник", () => {
  it("показывает текущий ник и превью, а невалидный ник — правила", async () => {
    signedIn();
    await mount();

    expect(field("Ник").value).toBe("anya");
    expect(fieldText("Ник")).toContain("@anya");
    expect(container.querySelector('[data-testid="page-footer"]')).not.toBeNull();

    await type("Ник", "New_Nick");
    expect(fieldText("Ник")).toContain("@new_nick");

    await type("Ник", "ab");
    expect(fieldText("Ник")).toContain("3–24 символа: латиница, цифры, _");
  });

  it("ник не по правилам: показывает правила и не шлёт запрос", async () => {
    signedIn();
    await mount();

    await type("Ник", "ab");
    await press("Сохранить");

    expect(me.updateNick).not.toHaveBeenCalled();
    expect(fieldText("Ник")).toContain("3–24 символа: латиница, цифры, _");
  });

  it("текущий ник: «Это ваш текущий ник.» и запрос не уходит", async () => {
    signedIn();
    await mount();

    await press("Сохранить");

    expect(me.updateNick).not.toHaveBeenCalled();
    expect(fieldText("Ник")).toContain("Это ваш текущий ник.");
  });

  it("занятый ник: ошибка под полем", async () => {
    signedIn();
    me.updateNick.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Nick is taken",
      field: "nick",
      reason: "NICK_TAKEN",
    });
    await mount();

    await type("Ник", "newnick");
    await press("Сохранить");

    expect(me.updateNick).toHaveBeenCalledWith("newnick");
    expect(fieldText("Ник")).toContain("Этот ник уже занят.");
  });

  it("413: причина показывается тостом, сырой текст сервера не виден", async () => {
    signedIn();
    me.updateNick.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Payload too large",
      reason: "PAYLOAD_TOO_LARGE",
    });
    await mount();

    await type("Ник", "newnick");
    await press("Сохранить");

    expect(text()).toContain("Слишком большой запрос. Сократите текст и попробуйте ещё раз.");
    expect(text()).not.toContain("Payload too large");
    expect(field("Ник").value).toBe("newnick");
  });

  it("невалидный ник: фокус на поле и прокрутка к нему (UI5)", async () => {
    signedIn();
    me.updateNick.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Nick is taken",
      field: "nick",
      reason: "NICK_TAKEN",
    });
    await mount();

    await type("Ник", "newnick");
    await press("Сохранить");

    const nick = field("Ник");
    expect(document.activeElement).toBe(nick);
    expect(nick.getAttribute("aria-invalid")).toBe("true");
    expect(scrollIntoView.mock.instances[0]).toBe(nick);
  });

  it("успех: тост, сохранённый ник и обновлённый контекст", async () => {
    signedIn();
    const changed = { ...user, nick: "newnick" };
    me.updateNick.mockResolvedValue({ ok: true, data: changed });
    await mount();

    await type("Ник", "New_Nick");
    await press("Сохранить");

    expect(me.updateNick).toHaveBeenCalledWith("New_Nick");
    expect(text()).toContain("Ник изменён.");
    expect(field("Ник").value).toBe("newnick");
    expect(field("Ник").readOnly).toBe(false);
    expect(probe.auth?.state).toEqual({ status: "ready", user: changed });
  });

  it("пока запрос идёт, кнопка недоступна и второй тап не шлёт второй запрос", async () => {
    signedIn();
    me.updateNick.mockReturnValue(new Promise(() => {}));
    await mount();

    await type("Ник", "newnick");
    await press("Сохранить");

    const save = button("Сохранить");
    // Busy keeps the button focusable: `aria-disabled`, not the `disabled` attribute.
    expect((save as HTMLButtonElement | undefined)?.disabled).toBe(false);
    expect(save?.getAttribute("aria-disabled")).toBe("true");
    expect(save?.getAttribute("aria-busy")).toBe("true");
    expect(field("Ник").readOnly).toBe(true);
    expect(me.updateNick).toHaveBeenCalledTimes(1);

    await act(async () => {
      save?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(me.updateNick).toHaveBeenCalledTimes(1);
  });

  it("обрыв сети: сообщение о сети и введённый ник на месте", async () => {
    signedIn();
    me.updateNick.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("Ник", "newnick");
    await press("Сохранить");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Ник").value).toBe("newnick");
    expect(probe.auth?.state).toEqual({ status: "ready", user });
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

  it("экран настроек отрисован: заголовок, поле ника и сохранение на месте", async () => {
    signedIn();
    await mountReady();

    expect(container.querySelector('[data-testid="settings-page"]')).not.toBeNull();
    const heading = container.querySelector("[role='heading']");
    expect(heading?.getAttribute("aria-level")).toBe("1");
    expect(heading?.textContent).toBe("Настройки");
    expect(field("Ник").value).toBe("anya");
    expect(button("Сохранить")).toBeDefined();
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
