// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, controlByText, typeInto } from "@/test/dom";
import RegisterScreen from "../../app/(auth)/register";
import ResetScreen from "../../app/(auth)/reset";

/**
 * The confirmation field of registration and reset: only the client compares it,
 * so it never reaches the contract or the request body. The line is silent until
 * the field is settled (blur or submit), then follows the two values live.
 */
const MISMATCH = "Пароли не совпадают.";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));
/** UI5: happy-dom has no layout, so the scroll call is the observable effect. */
const scrollIntoView = vi.hoisted(() => vi.fn());

vi.mock("@/api/client", () => api);
vi.mock("@/session/auth-context", () => ({
  useAuth: () => ({
    state: { status: "anonymous" as const },
    getSessionRevision: vi.fn(() => 0),
    setUser: vi.fn(),
    signOut: vi.fn(async () => ({ ok: true as const })),
  }),
}));
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const app = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
  ) as Record<string, unknown>;
  const common = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/common.json"), "utf8"),
  ) as Record<string, unknown>;

  function lookup(
    catalog: Record<string, unknown>,
    key: string,
    values?: Record<string, unknown>,
  ): string {
    let node: unknown = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  return {
    useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
      lookup(namespace === "common" ? common : app, key, values),
    useLocale: () => "ru",
  };
});
vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    router: { replace: vi.fn() },
    Stack: { Screen: () => null },
    Link: ({ children }: { children?: React.ReactNode }) => React.createElement("a", null, children),
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useLocalSearchParams: () => route.params,
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

function field(label: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, `поле «${label}»`).not.toBeNull();
  return input as HTMLInputElement;
}

/** The line the field is described by: its hint or its error. */
function describedBy(label: string): string {
  const id = field(label).getAttribute("aria-describedby");
  return (id ? document.getElementById(id)?.textContent : "") ?? "";
}

async function mount(screen: "register" | "reset") {
  route.params = screen === "reset" ? { token: "live-token" } : {};
  const Screen = screen === "register" ? RegisterScreen : ResetScreen;
  await act(async () => {
    root.render(<Screen />);
  });
}

async function fill(label: string, value: string) {
  await typeInto(field(label), value);
}

async function press(label: string) {
  const button = controlByText(label, container);
  expect(button, `кнопка «${label}»`).toBeTruthy();
  await click(button);
}

/** React listens to focus through the bubbling `focusout`. */
async function blur(label: string) {
  await act(async () => {
    field(label).dispatchEvent(new Event("focusout", { bubbles: true }));
  });
}

/** Enter in the field: `react-native-web` turns it into `onSubmitEditing`. */
async function enter(label: string) {
  await act(async () => {
    field(label).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
  });
}

function registrationBody(password = "password1234") {
  return {
    email: "a@b.test",
    password,
    displayName: "Анна",
    nick: "anna",
    next: "/",
  };
}

async function fillRegistration(password: string, confirm: string) {
  await fill("Email", "a@b.test");
  await fill("Пароль", password);
  await fill("Повторите пароль", confirm);
  await fill("Имя", "Анна");
  await fill("Ник", "anna");
}

beforeEach(() => {
  vi.clearAllMocks();
  scrollIntoView.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("регистрация: подтверждение пароля", () => {
  it("совпадение: запрос уходит, подтверждения в теле нет", async () => {
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: {
        user: { id: "u1", email: "a@b.test", name: "Анна", nick: "anna", timeZone: null },
        next: "/",
      },
    });
    await mount("register");
    await fillRegistration("password1234", "password1234");

    await press("Зарегистрироваться");

    // The body is exactly what the screen sent before the field existed.
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/register", {
      method: "POST",
      body: registrationBody(),
    });
    expect(describedBy("Повторите пароль")).toBe("");
  });

  it("несовпадение: запрос не уходит, ошибка под подтверждением и фокус на нём", async () => {
    await mount("register");
    await fillRegistration("password1234", "password12345");

    await press("Зарегистрироваться");

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(describedBy("Повторите пароль")).toBe(MISMATCH);
    const confirm = field("Повторите пароль");
    expect(confirm.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(confirm);
    expect(scrollIntoView.mock.instances[0]).toBe(confirm);
    // The error is announced like every other field error.
    expect(document.getElementById(confirm.getAttribute("aria-describedby") ?? "")?.getAttribute("role")).toBe("alert");
  });

  it("пока печатаешь — молчит; после blur — ошибка; исправил — пропала", async () => {
    await mount("register");
    await fill("Пароль", "password1");

    await fill("Повторите пароль", "password2");
    expect(describedBy("Повторите пароль")).toBe("");

    await blur("Повторите пароль");
    expect(describedBy("Повторите пароль")).toBe(MISMATCH);

    await fill("Повторите пароль", "password1");
    expect(describedBy("Повторите пароль")).toBe("");
  });

  it("изменили основной пароль после совпадения — ошибка появляется вживую", async () => {
    await mount("register");
    await fill("Пароль", "password1");
    await fill("Повторите пароль", "password1");
    await blur("Повторите пароль");
    expect(describedBy("Повторите пароль")).toBe("");

    await fill("Пароль", "password2");

    expect(describedBy("Повторите пароль")).toBe(MISMATCH);

    await fill("Пароль", "password1");
    expect(describedBy("Повторите пароль")).toBe("");
  });

  it("пустое подтверждение при отправке — та же ошибка", async () => {
    await mount("register");
    await fill("Email", "a@b.test");
    await fill("Пароль", "password1234");
    await fill("Имя", "Анна");
    await fill("Ник", "anna");

    await press("Зарегистрироваться");

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(describedBy("Повторите пароль")).toBe(MISMATCH);
    expect(document.activeElement).toBe(field("Повторите пароль"));
  });

  it("оба поля пароля просят браузер и телефон не подставлять старое", async () => {
    await mount("register");

    for (const label of ["Пароль", "Повторите пароль"]) {
      const input = field(label);
      expect(input.type).toBe("password");
      // `textContentType` is a native-only prop; the web carries `autoComplete`.
      expect(input.getAttribute("autocomplete")).toBe("new-password");
      expect(input.getAttribute("enterkeyhint")).toBe("next");
    }
  });

  it("Enter в пароле ведёт к подтверждению, Enter в подтверждении — к имени", async () => {
    await mount("register");

    await enter("Пароль");
    expect(document.activeElement).toBe(field("Повторите пароль"));

    await enter("Повторите пароль");
    expect(document.activeElement).toBe(field("Имя"));
  });

  it("ошибки email и пароля остаются первыми по порядку полей", async () => {
    await mount("register");
    await fill("Email", "not-an-email");
    await fill("Пароль", "1234567");
    await fill("Повторите пароль", "другое");

    await press("Зарегистрироваться");

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(describedBy("Email")).not.toBe("");
    expect(describedBy("Повторите пароль")).toBe("");
    expect(document.activeElement).toBe(field("Email"));
  });
});

describe("сброс пароля: подтверждение пароля", () => {
  it("совпадение: запрос уходит, тело — прежние token и password", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { saved: true } });
    await mount("reset");
    await fill("Пароль", "password1234");
    await fill("Повторите пароль", "password1234");
    expect(describedBy("Повторите пароль")).toBe("");

    await press("Сохранить пароль");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/password/reset", {
      method: "POST",
      body: { token: "live-token", password: "password1234" },
    });
  });

  it("несовпадение: запрос не уходит, ошибка и фокус на подтверждении", async () => {
    await mount("reset");
    await fill("Пароль", "password1234");
    await fill("Повторите пароль", "12345679");

    await press("Сохранить пароль");

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(describedBy("Повторите пароль")).toBe(MISMATCH);
    expect(document.activeElement).toBe(field("Повторите пароль"));
  });

  it("короткий пароль остаётся первым: его ошибка, а не подтверждения", async () => {
    await mount("reset");
    await fill("Пароль", "1234567");
    await fill("Повторите пароль", "другое");

    await press("Сохранить пароль");

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(describedBy("Пароль")).toBe("Минимум 12 символов");
    expect(describedBy("Повторите пароль")).toBe("");
    expect(document.activeElement).toBe(field("Пароль"));
  });

  it("пустое подтверждение при отправке — ошибка", async () => {
    await mount("reset");
    await fill("Пароль", "password1234");

    await press("Сохранить пароль");

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(describedBy("Повторите пароль")).toBe(MISMATCH);
  });

  it("Enter в пароле ведёт к подтверждению, Enter в подтверждении отправляет", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { saved: true } });
    await mount("reset");
    await fill("Пароль", "password1234");
    await fill("Повторите пароль", "password1234");
    expect(field("Повторите пароль").getAttribute("enterkeyhint")).toBe("done");

    await enter("Пароль");
    expect(document.activeElement).toBe(field("Повторите пароль"));
    expect(api.apiRequest).not.toHaveBeenCalled();

    await enter("Повторите пароль");

    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/password/reset", {
      method: "POST",
      body: { token: "live-token", password: "password1234" },
    });
  });

  it("оба поля пароля просят телефон не подставлять старое", async () => {
    await mount("reset");

    for (const label of ["Пароль", "Повторите пароль"]) {
      expect(field(label).getAttribute("autocomplete")).toBe("new-password");
    }
  });
});
