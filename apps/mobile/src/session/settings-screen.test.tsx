// @vitest-environment happy-dom
import type { Me } from "@gift-list/contracts";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/session/auth-context";
import { controls } from "@/test/dom";
import SettingsScreen from "../../app/(app)/settings";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const me = vi.hoisted(() => ({ updateNick: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(),
}));

vi.mock("@/api/client", () => api);
vi.mock("@/api/me", () => me);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
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
  it("аноним уходит на вход с возвратом в настройки", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/settings" },
    });
    expect(text()).toBe("");
  });
});

describe("настройки: ник", () => {
  it("показывает текущий ник и превью, а невалидный ник — правила", async () => {
    signedIn();
    await mount();

    expect(field("Ник").value).toBe("anya");
    expect(fieldText("Ник")).toContain("@anya");

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
