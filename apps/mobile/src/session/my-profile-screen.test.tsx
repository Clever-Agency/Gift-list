// @vitest-environment happy-dom
import type { Me } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, settle } from "@/test/dom";
import MyProfileScreen from "../../app/(app)/(tabs)/profile";

/**
 * «Профиль» (CLE-129, D-59): the tab is a data screen now — avatar, name, nick
 * and email, each editable field with its own save, then the menu of the own
 * public profile, the settings, the support link and «Выйти». The nick form
 * moved here from «Настройки». Birthday, gender, country and «Обо мне» come
 * with T8; the email change with T9.
 */
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const account = vi.hoisted(() => ({ updateName: vi.fn(), updateNick: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/api/client", () => api);
vi.mock("@/api/me", () => account);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
vi.mock("expo-linking", () => ({ openURL: vi.fn(() => Promise.resolve()) }));
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
  const catalogs = { app: read("app"), common: read("common"), web: read("web") };

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
      head === "common" ? catalogs.common : head === "web" ? catalogs.web : catalogs.app;
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
  hideFromSearch: false,
};

let root: Root;
let container: HTMLElement;

/** `/api/v1/me` answers with the session; every other read is a successful no-op. */
function respond(session: unknown) {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? session : { ok: true, data: { signedOut: true } },
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

/** React listens to focus through the bubbling `focusout`. */
async function blur(label: string) {
  await act(async () => {
    field(label).dispatchEvent(new Event("focusout", { bubbles: true }));
  });
}

function button(label: string): HTMLElement | undefined {
  return controls(container).find((node) => (node.textContent ?? "").includes(label));
}

/** A link by its visible text: «Написать в техподдержку» is a `SupportLink`, not a button. */
function link(label: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="link"]')).find(
    (node) => (node.textContent ?? "").trim() === label,
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

/** The two saves share the visible «Сохранить»: the call goes by the accessible name. */
async function pressLabel(label: string) {
  const target = controls(container).find((node) => node.getAttribute("aria-label") === label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <MyProfileScreen />
      </AuthProvider>,
    );
  });
  await settle(10);
}

beforeEach(() => {
  vi.clearAllMocks();
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("профиль: гейт сессии", () => {
  it("пока сессия неизвестна, показывает экран загрузки и никуда не уводит", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="session-loading"]')).not.toBeNull();
  });

  it("аноним с /profile уходит на вход с возвратом в «Профиль»", async () => {
    respond({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/profile" },
    });
    expect(text()).not.toContain("Мой профиль");
  });

  it("выход с уже погашенной сессией всё равно открывает вход", async () => {
    respond({ ok: true, data: user });
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/me"
          ? { ok: true, data: user }
          : path === "/api/v1/session"
            ? { ok: false, code: "UNAUTHENTICATED", message: "" }
            : { ok: true, data: { signedOut: true } },
      ),
    );
    await press("Выйти");

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/profile" },
    });
  });

  it("обрыв сети при проверке сессии — экран ошибки с «Повторить»", async () => {
    respond({ ok: false, network: true });
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="session-error"]')).not.toBeNull();
    expect(text()).toContain("Нет связи с сервером");
    expect(text()).toContain("Повторить");
  });
});

describe("профиль: мои данные", () => {
  it("аватар-инициалы, имя, @ник, email и меню — в одном экране", async () => {
    respond({ ok: true, data: user });
    await mount();

    const heading = container.querySelector('[role="heading"][aria-level="1"]');
    expect(heading?.textContent).toBe("Профиль");

    const avatar = container.querySelector('[data-testid="profile-avatar"]');
    expect(avatar).not.toBeNull();
    expect(avatar?.textContent).toBe("А");
    // The name is written next to the circle, so the avatar is hidden from the reader.
    expect(avatar?.getAttribute("aria-hidden")).toBe("true");

    expect(container.querySelector('[data-testid="profile-name"]')?.textContent).toBe("Аня");
    expect(text()).toContain("@anya");
    expect(container.querySelector('[data-testid="profile-email"]')?.textContent).toBe(
      "a@b.test",
    );

    expect(button("Мой профиль")).toBeDefined();
    expect(button("Настройки")).toBeDefined();
    expect(link("Написать в техподдержку")).toBeDefined();
    expect(button("Выйти")).toBeDefined();
  });

  it("показывает имя и ник из /me в полях с подписями", async () => {
    respond({ ok: true, data: user });
    await mount();

    expect(field("Имя").value).toBe("Аня");
    expect(field("Ник").value).toBe("anya");
    // Each save has its own accessible name: two visible «Сохранить» never collide.
    expect(
      controls(container).filter((node) => node.getAttribute("aria-label") === "Сохранить имя"),
    ).toHaveLength(1);
    expect(
      controls(container).filter((node) => node.getAttribute("aria-label") === "Сохранить ник"),
    ).toHaveLength(1);
  });

  it("«Подборок» и уведомлений нет", async () => {
    respond({ ok: true, data: user });
    await mount();

    expect(text()).not.toContain("Подборк");
    expect(text()).not.toContain("Уведомлен");
  });
});

describe("профиль: имя", () => {
  it("пустое имя не уходит на сервер, причина под полем", async () => {
    respond({ ok: true, data: user });
    await mount();

    await type("Имя", "   ");
    await pressLabel("Сохранить имя");

    expect(account.updateName).not.toHaveBeenCalled();
    expect(fieldText("Имя")).toContain("Имя не может быть пустым.");
  });

  it("текущее имя: «Это ваше текущее имя.» и запрос не уходит", async () => {
    respond({ ok: true, data: user });
    await mount();

    await pressLabel("Сохранить имя");

    expect(account.updateName).not.toHaveBeenCalled();
    expect(fieldText("Имя")).toContain("Это ваше текущее имя.");
  });

  it("успех: имя, тост и обновлённая шапка", async () => {
    respond({ ok: true, data: user });
    const renamed = { ...user, name: "Анна Ковалёва" };
    account.updateName.mockResolvedValue({ ok: true, data: renamed });
    await mount();

    await type("Имя", "  Анна Ковалёва  ");
    await pressLabel("Сохранить имя");

    // The trimmed value goes out; the server trims again.
    expect(account.updateName).toHaveBeenCalledWith("Анна Ковалёва");
    expect(text()).toContain("Имя изменено.");
    expect(field("Имя").value).toBe("Анна Ковалёва");
    expect(container.querySelector('[data-testid="profile-name"]')?.textContent).toBe(
      "Анна Ковалёва",
    );
    // The avatar initials follow the new name from the context.
    expect(container.querySelector('[data-testid="profile-avatar"]')?.textContent).toBe("АК");
  });

  it("обрыв сети: тост и введённое имя на месте", async () => {
    respond({ ok: true, data: user });
    account.updateName.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("Имя", "Анна");
    await pressLabel("Сохранить имя");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Имя").value).toBe("Анна");
  });

  it("401: сессия закончилась, вход с возвратом в «Профиль»", async () => {
    respond({ ok: true, data: user });
    account.updateName.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    await mount();

    await type("Имя", "Анна");
    await pressLabel("Сохранить имя");

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/profile", reason: "session_expired" },
    });
  });
});

describe("профиль: ник", () => {
  it("показывает текущий ник и превью; длина становится ошибкой после blur", async () => {
    respond({ ok: true, data: user });
    await mount();

    expect(field("Ник").value).toBe("anya");
    expect(fieldText("Ник")).toContain("@anya");

    await type("Ник", "New_Nick");
    expect(fieldText("Ник")).toContain("@new_nick");

    await type("Ник", "ab");
    expect(fieldText("Ник")).not.toContain("не короче");
    await blur("Ник");
    expect(fieldText("Ник")).toContain("Ник должен быть не короче 3 символов");
  });

  it("кириллица и запрещённый символ названы под полем", async () => {
    respond({ ok: true, data: user });
    await mount();

    await type("Ник", "аня");
    expect(fieldText("Ник")).toContain("Ник пишется латиницей — без русских букв");
    expect(fieldText("Ник")).not.toContain("@");

    await type("Ник", "an#a");
    expect(fieldText("Ник")).toContain(
      "Символ «#» нельзя использовать. Подойдут латинские буквы, цифры и _",
    );
  });

  it("ник не по правилам: при сохранении показывает причину и не шлёт запрос", async () => {
    respond({ ok: true, data: user });
    await mount();

    await type("Ник", "ab");
    await pressLabel("Сохранить ник");

    expect(account.updateNick).not.toHaveBeenCalled();
    expect(fieldText("Ник")).toContain("Ник должен быть не короче 3 символов");
  });

  it("текущий ник: «Это ваш текущий ник.» и запрос не уходит", async () => {
    respond({ ok: true, data: user });
    await mount();

    await pressLabel("Сохранить ник");

    expect(account.updateNick).not.toHaveBeenCalled();
    expect(fieldText("Ник")).toContain("Это ваш текущий ник.");
  });

  it("занятый ник: ошибка под полем", async () => {
    respond({ ok: true, data: user });
    account.updateNick.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Nick is taken",
      field: "nick",
      reason: "NICK_TAKEN",
    });
    await mount();

    await type("Ник", "newnick");
    await pressLabel("Сохранить ник");

    expect(account.updateNick).toHaveBeenCalledWith("newnick");
    expect(fieldText("Ник")).toContain("Этот ник уже занят.");
  });

  it("413: причина показывается тостом, сырой текст сервера не виден", async () => {
    respond({ ok: true, data: user });
    account.updateNick.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Payload too large",
      reason: "PAYLOAD_TOO_LARGE",
    });
    await mount();

    await type("Ник", "newnick");
    await pressLabel("Сохранить ник");

    expect(text()).toContain("Слишком большой запрос. Сократите текст и попробуйте ещё раз.");
    expect(text()).not.toContain("Payload too large");
    expect(field("Ник").value).toBe("newnick");
  });

  it("успех: тост, сохранённый ник и обновлённая шапка", async () => {
    respond({ ok: true, data: user });
    const changed = { ...user, nick: "newnick" };
    account.updateNick.mockResolvedValue({ ok: true, data: changed });
    await mount();

    await type("Ник", "New_Nick");
    await pressLabel("Сохранить ник");

    expect(account.updateNick).toHaveBeenCalledWith("New_Nick");
    expect(text()).toContain("Ник изменён.");
    expect(field("Ник").value).toBe("newnick");
    expect(field("Ник").readOnly).toBe(false);
    // The header reads the nickname from the context, so it changes at once.
    expect(text()).toContain("@newnick");
  });

  it("пока запрос идёт, кнопка недоступна и второй тап не шлёт второй запрос", async () => {
    respond({ ok: true, data: user });
    account.updateNick.mockReturnValue(new Promise(() => {}));
    await mount();

    await type("Ник", "newnick");
    await pressLabel("Сохранить ник");

    const save = controls(container).find(
      (node) => node.getAttribute("aria-label") === "Сохранить ник",
    );
    // Busy keeps the button focusable: `aria-disabled`, not the `disabled` attribute.
    expect((save as HTMLButtonElement | undefined)?.disabled).toBe(false);
    expect(save?.getAttribute("aria-disabled")).toBe("true");
    expect(save?.getAttribute("aria-busy")).toBe("true");
    expect(field("Ник").readOnly).toBe(true);
    expect(account.updateNick).toHaveBeenCalledTimes(1);

    await act(async () => {
      save?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(account.updateNick).toHaveBeenCalledTimes(1);
  });

  it("обрыв сети: сообщение о сети и введённый ник на месте", async () => {
    respond({ ok: true, data: user });
    account.updateNick.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("Ник", "newnick");
    await pressLabel("Сохранить ник");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Ник").value).toBe("newnick");
  });
});

describe("профиль: меню", () => {
  it("«Мой профиль» подписан «Как меня видят другие» и открывает /u/{nick}", async () => {
    respond({ ok: true, data: user });
    await mount();

    expect(text()).toContain("Как меня видят другие");
    await press("Мой профиль");
    expect(navigation.push).toHaveBeenCalledWith({
      pathname: "/u/[nick]",
      params: { nick: "anya" },
    });
  });

  it("«Настройки» открывают /settings", async () => {
    respond({ ok: true, data: user });
    await mount();

    await press("Настройки");
    expect(navigation.push).toHaveBeenCalledWith("/settings");
  });
});

describe("профиль: выход", () => {
  it("«Выйти» гасит сессию и открывает вход с возвратом в «Профиль»", async () => {
    respond({ ok: true, data: user });
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/me"
          ? { ok: true, data: user }
          : path === "/api/v1/session"
            ? { ok: true, data: { signedOut: true } }
            : { ok: true, data: { signedOut: true } },
      ),
    );
    await press("Выйти");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/session", { method: "DELETE" });
    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/profile" },
    });
  });

  it("обрыв сети при выходе оставляет человека в «Профиле» и показывает toast", async () => {
    respond({ ok: true, data: user });
    await mount();

    api.apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/api/v1/me"
          ? { ok: true, data: user }
          : path === "/api/v1/session"
            ? { ok: false, network: true }
            : { ok: true, data: { signedOut: true } },
      ),
    );
    await press("Выйти");

    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toContain("Профиль");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("на 360 px поля и выход остаются на месте", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 360,
    });
    window.dispatchEvent(new Event("resize"));
    respond({ ok: true, data: user });
    await mount();

    expect(field("Имя").value).toBe("Аня");
    expect(button("Выйти")).toBeDefined();
  });
});
