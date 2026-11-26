// @vitest-environment happy-dom
import type { Me, MyProfile } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import { controls, dialogElement, settle, typeInto } from "@/test/dom";
import MyProfileScreen from "../../app/(app)/(tabs)/profile";

/**
 * «Профиль» (CLE-129, D-59): the tab is a data screen now — avatar, name, nick
 * and email, each editable field with its own save, then «О себе» (birthday,
 * gender, country, «Обо мне» and the friends switch, T8.3), then the menu of the
 * own public profile, the settings, the support link and «Выйти». The nick form
 * moved here from «Настройки»; the email change comes with T9.
 */
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const account = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
  updateName: vi.fn(),
  updateNick: vi.fn(),
  requestEmailChange: vi.fn(),
  cancelEmailChange: vi.fn(),
}));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  setParams: vi.fn(),
}));
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));

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
  useLocalSearchParams: () => route.params,
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

/** «О себе» starts empty: every field is optional (D-64). */
const profile: MyProfile = {
  ...user,
  birthDay: null,
  birthMonth: null,
  gender: null,
  country: null,
  about: null,
  profileVisibleToFriends: true,
};

/** The month names the form builds with `Intl.DateTimeFormat`. */
function monthName(month: number): string {
  return new Intl.DateTimeFormat("ru", { month: "long" }).format(
    new Date(Date.UTC(2000, month - 1, 1)),
  );
}

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

/** «Обо мне» is a `<textarea>`; the shared `field` helper reads inputs only. */
function area(label: string): HTMLTextAreaElement {
  const node = Array.from(container.querySelectorAll("textarea")).find(
    (item) => item.getAttribute("aria-label") === label,
  );
  expect(node, `поле «${label}»`).toBeDefined();
  return node as HTMLTextAreaElement;
}

function areaText(label: string): string {
  return area(label).parentElement?.textContent ?? "";
}

/** The opener of a value picker: its accessible name is «label: current value». */
function pickerButton(name: string): HTMLElement | undefined {
  return controls(document).find((node) =>
    (node.getAttribute("aria-label") ?? "").startsWith(`${name}:`),
  );
}

async function openPicker(name: string): Promise<HTMLElement | null> {
  const opener = pickerButton(name);
  expect(opener, `поле «${name}»`).toBeDefined();
  await act(async () => {
    opener?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
  return dialogElement();
}

async function pickOption(name: string, option: string) {
  const layer = await openPicker(name);
  expect(layer, `слой «${name}»`).not.toBeNull();
  const radio = Array.from(layer?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []).find(
    (node) => (node.textContent ?? "").trim() === option,
  );
  expect(radio, `вариант «${option}» в «${name}»`).toBeDefined();
  await act(async () => {
    radio?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/** A switch is a `role="switch"` press surface, outside the `CONTROLS` helpers. */
function switchNode(label: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `[role="switch"][aria-label="${label}"]`,
  );
}

async function pressSwitch(label: string) {
  const node = switchNode(label);
  expect(node, `переключатель «${label}»`).not.toBeNull();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
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
  route.params = {};
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  account.getMyProfile.mockResolvedValue({ ok: true, data: profile });
  account.updateMyProfile.mockResolvedValue({ ok: true, data: profile });
  account.requestEmailChange.mockResolvedValue({ ok: true });
  account.cancelEmailChange.mockResolvedValue({ ok: true });
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

describe("профиль: смена email", () => {
  it("«Изменить» открывает поле нового адреса, текущий адрес остаётся виден", async () => {
    respond({ ok: true, data: user });
    await mount();

    expect(container.querySelector('[data-testid="profile-email"]')?.textContent).toBe("a@b.test");
    await press("Изменить");

    expect(field("Новый email").value).toBe("");
    expect(container.querySelector('[data-testid="profile-email"]')?.textContent).toBe("a@b.test");
    expect(button("Отправить письмо")).toBeDefined();
  });

  it("неверный адрес: причина под полем, запрос не уходит", async () => {
    respond({ ok: true, data: user });
    await mount();

    await press("Изменить");
    await type("Новый email", "anna");
    await press("Отправить письмо");

    expect(account.requestEmailChange).not.toHaveBeenCalled();
    expect(fieldText("Новый email")).toContain("Проверьте введённые данные.");
  });

  it("текущий адрес: «Это ваш текущий email.» и запрос не уходит", async () => {
    respond({ ok: true, data: user });
    await mount();

    await press("Изменить");
    await type("Новый email", "A@B.test");
    await press("Отправить письмо");

    expect(account.requestEmailChange).not.toHaveBeenCalled();
    expect(fieldText("Новый email")).toContain("Это ваш текущий email.");
  });

  it("отправка: trimmed-адрес уходит, ожидание с «Отправить ещё раз» и «Отменить»", async () => {
    respond({ ok: true, data: user });
    await mount();

    await press("Изменить");
    await type("Новый email", "  New@Example.COM ");
    await press("Отправить письмо");

    expect(account.requestEmailChange).toHaveBeenCalledWith("new@example.com");
    expect(text()).toContain(
      "Мы отправили письмо на new@example.com. Перейдите по ссылке, чтобы подтвердить.",
    );
    expect(button("Отправить ещё раз")).toBeDefined();
    expect(button("Отменить")).toBeDefined();
    expect(text()).not.toContain("Новый email");
  });

  it("лимит на повторной отправке: понятный текст в ожидании", async () => {
    respond({ ok: true, data: user });
    account.requestEmailChange
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: false,
        code: "RATE_LIMITED",
        message: "Too many email change attempts",
        params: { unit: "minute", count: 15 },
      });
    await mount();

    await press("Изменить");
    await type("Новый email", "new@example.com");
    await press("Отправить письмо");
    await press("Отправить ещё раз");

    // The test translator leaves the ICU select as is; the sentence is the
    // shared `errors.code.RATE_LIMITED`, which the app resolves to minutes.
    expect(text()).toContain("Слишком много попыток. Попробуйте через");
    expect(text()).toContain("Мы отправили письмо на new@example.com.");
    expect(button("Отправить ещё раз")).toBeDefined();
  });

  it("«Отправить ещё раз» шлёт тот же адрес и снова ждёт", async () => {
    respond({ ok: true, data: user });
    await mount();

    await press("Изменить");
    await type("Новый email", "new@example.com");
    await press("Отправить письмо");
    await press("Отправить ещё раз");

    expect(account.requestEmailChange).toHaveBeenCalledTimes(2);
    expect(account.requestEmailChange).toHaveBeenLastCalledWith("new@example.com");
    expect(text()).toContain("Мы отправили письмо на new@example.com.");
  });

  it("«Отменить» убирает ожидание и говорит об отмене", async () => {
    respond({ ok: true, data: user });
    await mount();

    await press("Изменить");
    await type("Новый email", "new@example.com");
    await press("Отправить письмо");
    await press("Отменить");

    expect(account.cancelEmailChange).toHaveBeenCalledTimes(1);
    expect(text()).toContain("Запрос на смену email отменён.");
    expect(button("Изменить")).toBeDefined();
    expect(text()).not.toContain("Мы отправили письмо на");
  });

  it("сеть при отправке: тост и введённый адрес на месте", async () => {
    respond({ ok: true, data: user });
    account.requestEmailChange.mockResolvedValue({ ok: false, network: true });
    await mount();

    await press("Изменить");
    await type("Новый email", "new@example.com");
    await press("Отправить письмо");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Новый email").value).toBe("new@example.com");
    expect(text()).not.toContain("Мы отправили письмо на");
  });

  it("401 при отправке гасит сессию и ведёт на вход", async () => {
    respond({ ok: true, data: user });
    account.requestEmailChange.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    await mount();

    await press("Изменить");
    await type("Новый email", "new@example.com");
    await press("Отправить письмо");

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/profile", reason: "session_expired" },
    });
  });

  it("возврат с ?emailChanged=1: тост, новый адрес из /me и очищенный запрос", async () => {
    route.params = { emailChanged: "1" };
    const changed = { ...user, email: "new@example.com" };
    let sessionReads = 0;
    api.apiRequest.mockImplementation((path: string) => {
      if (path === "/api/v1/me") {
        sessionReads += 1;
        return Promise.resolve({ ok: true, data: sessionReads === 1 ? user : changed });
      }
      return Promise.resolve({ ok: true, data: { signedOut: true } });
    });
    await mount();
    await settle(20);

    expect(navigation.setParams).toHaveBeenCalledWith({
      emailChanged: undefined,
      error: undefined,
    });
    expect(sessionReads).toBe(2);
    expect(text()).toContain("Адрес изменён.");
    expect(container.querySelector('[data-testid="profile-email"]')?.textContent).toBe(
      "new@example.com",
    );
  });

  it("возврат с просроченной ссылкой: понятный текст и очищенный запрос", async () => {
    route.params = { error: "TOKEN_EXPIRED" };
    respond({ ok: true, data: user });
    await mount();
    await settle(20);

    expect(text()).toContain("Ссылка устарела. Запросите новое письмо.");
    expect(navigation.setParams).toHaveBeenCalledWith({
      emailChanged: undefined,
      error: undefined,
    });
  });

  it("просроченная ссылка приходит вместе с флагом успеха: ошибка важнее", async () => {
    route.params = { emailChanged: "1", error: "TOKEN_EXPIRED" };
    respond({ ok: true, data: user });
    await mount();
    await settle(20);

    expect(text()).toContain("Ссылка устарела. Запросите новое письмо.");
    expect(text()).not.toContain("Адрес изменён.");
  });

  it("неизвестный код ссылки: общий понятный текст", async () => {
    route.params = { error: "SOMETHING_NEW" };
    respond({ ok: true, data: user });
    await mount();
    await settle(20);

    expect(text()).toContain("Не получилось подтвердить адрес. Запросите новое письмо.");
  });
});

describe("профиль: «О себе»", () => {
  it("показывает все поля, счётчик и включённый переключатель", async () => {
    respond({ ok: true, data: user });
    await mount();

    expect(text()).toContain("О себе");
    expect(account.getMyProfile).toHaveBeenCalledTimes(1);
    expect(pickerButton("День рождения, день")?.textContent).toBe("Не указано");
    expect(pickerButton("День рождения, месяц")?.textContent).toBe("Не указано");
    expect(pickerButton("Страна")?.textContent).toBe("Не указана");
    for (const label of ["Мужской", "Женский", "Не указан"]) {
      expect(
        container.querySelector(`[role="radio"][aria-label="${label}"]`),
        `радио «${label}»`,
      ).not.toBeNull();
    }
    expect(area("Обо мне").value).toBe("");
    expect(areaText("Обо мне")).toContain("0 из 500");

    const toggle = container.querySelector(
      '[role="switch"][aria-label="Показывать мои данные друзьям"]',
    );
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("Видят только друзья");
  });

  it("29 февраля допустим, 30 февраля выбрать нельзя", async () => {
    respond({ ok: true, data: user });
    await mount();

    await pickOption("День рождения, месяц", monthName(2));
    const layer = await openPicker("День рождения, день");
    expect(layer).not.toBeNull();
    const options = Array.from(layer?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []).map(
      (node) => (node.textContent ?? "").trim(),
    );
    expect(options).toContain("29");
    expect(options).not.toContain("30");
  });

  it("счётчик «Обо мне» считает знаки и не пускает больше 500", async () => {
    respond({ ok: true, data: user });
    await mount();

    await typeInto(area("Обо мне"), "Привет");
    expect(areaText("Обо мне")).toContain("6 из 500");

    await typeInto(area("Обо мне"), "а".repeat(501));
    expect(areaText("Обо мне")).toContain("501 из 500");
    await pressLabel("Сохранить «О себе»");

    expect(account.updateMyProfile).not.toHaveBeenCalled();
    expect(areaText("Обо мне")).toContain("«Обо мне» — до 500 знаков.");
  });

  it("«Сохранить» отправляет блок целиком, ДР — парой", async () => {
    respond({ ok: true, data: user });
    account.getMyProfile.mockResolvedValue({ ok: true, data: { ...profile, country: "BY" } });
    const saved: MyProfile = {
      ...profile,
      birthDay: 14,
      birthMonth: 11,
      gender: "FEMALE",
      country: "BY",
      about: "Люблю книги",
      profileVisibleToFriends: false,
    };
    account.updateMyProfile.mockResolvedValue({ ok: true, data: saved });
    await mount();

    await pickOption("День рождения, месяц", monthName(11));
    await pickOption("День рождения, день", "14");
    await press("Женский");
    await typeInto(area("Обо мне"), "  Люблю книги  ");
    await pressSwitch("Показывать мои данные друзьям");
    await pressLabel("Сохранить «О себе»");

    expect(account.updateMyProfile).toHaveBeenCalledWith({
      birthDay: 14,
      birthMonth: 11,
      gender: "FEMALE",
      country: "BY",
      about: "Люблю книги",
      profileVisibleToFriends: false,
    });
    expect(text()).toContain("Данные сохранены.");
  });

  it("переключатель «Показывать мои данные друзьям» меняет состояние", async () => {
    respond({ ok: true, data: user });
    await mount();

    const toggle = () => switchNode("Показывать мои данные друзьям");
    expect(toggle()?.getAttribute("aria-checked")).toBe("true");
    await pressSwitch("Показывать мои данные друзьям");
    expect(toggle()?.getAttribute("aria-checked")).toBe("false");
  });

  it("ошибка страны от сервера показывается под полем", async () => {
    respond({ ok: true, data: user });
    account.updateMyProfile.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "",
      field: "country",
    });
    await mount();

    await pressLabel("Сохранить «О себе»");

    expect(text()).toContain("Выберите страну из списка.");
    expect(text()).not.toContain("Данные сохранены.");
  });

  it("если «О себе» не загрузилось, есть «Повторить»", async () => {
    respond({ ok: true, data: user });
    account.getMyProfile.mockResolvedValueOnce({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить данные профиля. Проверьте сеть.");
    account.getMyProfile.mockResolvedValueOnce({ ok: true, data: profile });
    await press("Повторить");

    expect(area("Обо мне")).toBeDefined();
  });

  it("401 при загрузке «О себе» гасит сессию и ведёт на вход", async () => {
    respond({ ok: true, data: user });
    account.getMyProfile.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });
    await mount();
    await settle(20);

    expect(store.clearSessionToken).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/profile", reason: "session_expired" },
    });
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

  it("ограничение частоты выхода оставляет человека в «Профиле» и показывает ответ сервера", async function rateLimitedSignOut() {
    respond({ ok: true, data: user });
    await mount();
    api.apiRequest.mockResolvedValueOnce({ ok: false, code: "RATE_LIMITED", message: "" });

    await press("Выйти");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/session", { method: "DELETE" });
    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(button("Выйти")).toBeDefined();
    expect(text()).toContain("Слишком много попыток.");
    expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
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
