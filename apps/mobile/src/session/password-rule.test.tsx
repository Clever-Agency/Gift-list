// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, controlByLabel, controlByText, typeInto } from "@/test/dom";
import LoginScreen from "../../app/(auth)/login";
import RegisterScreen from "../../app/(auth)/register";
import ResetScreen from "../../app/(auth)/reset";

const RULE = "Минимум 8 символов";
const TOO_LONG = "Пароль — до 128 символов.";
const GENERIC = "Проверьте введённые данные.";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));
/** UI5: happy-dom has no layout, so the scroll call is the observable effect. */
const scrollIntoView = vi.hoisted(() => vi.fn());

vi.mock("@/api/client", () => api);
vi.mock("@/session/auth-context", () => ({
  useAuth: () => ({
    state: { status: "anonymous" as const },
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
  const app = JSON.parse(readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8")) as Record<
    string,
    unknown
  >;
  const common = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/common.json"), "utf8"),
  ) as Record<string, unknown>;

  function lookup(catalog: Record<string, unknown>, key: string, values?: Record<string, unknown>): string {
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
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

/**
 * The text a screen shows as a hint or as an error: its own coloured `Text`, and the line
 * under a field, which `TextField` marks as an alert when it is an error.
 */
function toneText(tone: "hint" | "error"): string {
  const own = Array.from(container.querySelectorAll(`span[data-tone="${tone}"]`));
  const underField = Array.from(container.querySelectorAll('[id$="-description"]')).filter(
    (node) => (node.getAttribute("role") === "alert") === (tone === "error"),
  );
  return [...own, ...underField].map((node) => node.textContent ?? "").join("\n");
}

/** The line a field is described by: its hint or its error. */
function describedBy(label: string): string {
  const input = container.querySelector(`input[aria-label="${label}"]`);
  const id = input?.getAttribute("aria-describedby");
  return (id ? document.getElementById(id)?.textContent : "") ?? "";
}

async function mount(screen: "register" | "reset" | "login") {
  route.params = screen === "reset" ? { token: "live-token" } : {};
  const Screen = screen === "register" ? RegisterScreen : screen === "reset" ? ResetScreen : LoginScreen;
  await act(async () => {
    root.render(<Screen />);
  });
}

async function fill(label: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, `поле «${label}»`).not.toBeNull();
  await typeInto(input as HTMLInputElement, value);
}

async function press(label: string) {
  const button = controlByText(label, container);
  expect(button).toBeTruthy();
  await click(button);
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

describe("требование к паролю", () => {
  it("на регистрации короткий пароль показывает подсказку, а после отправки — ошибку поля", async () => {
    await mount("register");
    expect(container.querySelector('[data-testid="page-footer"]')).not.toBeNull();
    expect(toneText("hint")).toContain(RULE);
    expect(toneText("error")).not.toContain(RULE);
    expect(describedBy("Пароль")).toBe(RULE);

    await fill("Email", "a@b.test");
    await fill("Пароль", "1234567");
    await fill("Имя", "Анна");
    await fill("Ник", "anna");
    expect(toneText("hint")).toContain(RULE);

    await press("Зарегистрироваться");
    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(toneText("error")).toContain(RULE);
    expect(toneText("error")).not.toContain(GENERIC);
    expect(toneText("hint")).not.toContain(RULE);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(RULE);
  });

  it("на регистрации пароль длиннее 128 units показывает свой предел, а не общий текст", async () => {
    await mount("register");
    await fill("Email", "a@b.test");
    await fill("Пароль", "x".repeat(129));
    await fill("Имя", "Анна");
    await fill("Ник", "anna");
    expect(toneText("hint")).not.toContain(RULE);

    await press("Зарегистрироваться");
    expect(api.apiRequest).not.toHaveBeenCalled();
    // The field says what is wrong instead of the generic "check your input".
    expect(toneText("error")).toContain(TOO_LONG);
    expect(toneText("error")).not.toContain(GENERIC);
    expect(toneText("error")).not.toContain(RULE);
    expect(describedBy("Пароль")).toBe(TOO_LONG);
  });

  it("на регистрации 65 эмодзи (130 units) называют предел, 64 (128 units) уходят как есть", async () => {
    await mount("register");
    await fill("Email", "a@b.test");
    await fill("Пароль", "🎁".repeat(65));
    await fill("Имя", "Анна");
    await fill("Ник", "anna");

    await press("Зарегистрироваться");
    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(toneText("error")).toContain(TOO_LONG);

    // 64 emoji are exactly 128 UTF-16 units: the password reaches the request
    // untouched — no trimming and no normalisation of the value.
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: { user: { id: "u1", email: "a@b.test", name: "Анна", nick: "anna", timeZone: null }, next: "/" },
    });
    const emojiPassword = "🎁".repeat(64);
    await fill("Пароль", emojiPassword);
    await press("Зарегистрироваться");

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/api/v1/register",
      expect.objectContaining({
        body: expect.objectContaining({ password: emojiPassword }),
      }),
    );
  });

  it("пароль уходит без trim: пробелы по краям — часть значения", async () => {
    const typed = "  secret123  ";
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: { user: { id: "u1", email: "a@b.test", name: "Анна", nick: "anna", timeZone: null }, next: "/" },
    });
    await mount("register");
    await fill("Email", "a@b.test");
    await fill("Пароль", typed);
    await fill("Имя", "Анна");
    await fill("Ник", "anna");

    await press("Зарегистрироваться");

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/api/v1/register",
      expect.objectContaining({
        body: expect.objectContaining({ password: typed }),
      }),
    );
  });

  it("на регистрации пароль из 8 символов прячет подсказку, а VALIDATION сервера не называет минимум", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "password",
    });
    await mount("register");
    await fill("Email", "a@b.test");
    await fill("Пароль", "12345678");
    await fill("Имя", "Анна");
    await fill("Ник", "anna");
    expect(toneText("hint")).not.toContain(RULE);

    await press("Зарегистрироваться");
    expect(api.apiRequest).toHaveBeenCalled();
    expect(toneText("error")).toContain(GENERIC);
    expect(toneText("error")).not.toContain(RULE);
  });

  it("на новом пароле короткий пароль показывает подсказку и ошибку, а длинный ответ сервера — общий текст", async () => {
    await mount("reset");
    expect(container.querySelector('[data-testid="page-footer"]')).not.toBeNull();
    expect(toneText("hint")).toContain(RULE);
    expect(describedBy("Пароль")).toBe(RULE);

    await fill("Пароль", "1234567");
    await press("Сохранить пароль");
    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(toneText("error")).toContain(RULE);
    expect(toneText("error")).not.toContain(GENERIC);

    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "password",
    });
    await fill("Пароль", "12345678");
    expect(toneText("hint")).not.toContain(RULE);
    await press("Сохранить пароль");
    expect(toneText("error")).toContain(GENERIC);
    expect(toneText("error")).not.toContain(RULE);
  });

  it("на новом пароле пароль длиннее 128 units называет предел", async () => {
    await mount("reset");
    await fill("Пароль", "x".repeat(129));

    await press("Сохранить пароль");

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(toneText("error")).toContain(TOO_LONG);
    expect(toneText("error")).not.toContain(GENERIC);
    expect(toneText("error")).not.toContain(RULE);
  });

  it("на входе пароль длиннее 128 units называет предел, короткий — нет", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Invalid credentials",
    });
    await mount("login");
    await fill("Email", "a@b.test");
    await fill("Пароль", "x".repeat(129));

    await press("Войти");

    // Sign-in keeps the stored lower bound at 1: only the cap has a sentence.
    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(toneText("error")).toContain(TOO_LONG);
    expect(container.textContent ?? "").not.toContain(RULE);

    await fill("Пароль", "1234567");
    expect(toneText("error")).toBe("");
    await press("Войти");
    expect(api.apiRequest).toHaveBeenCalledTimes(1);
  });

  it("на входе требование к новому паролю не показывается", async () => {
    await mount("login");
    expect(container.textContent ?? "").not.toContain(RULE);
    await fill("Пароль", "1234567");
    expect(container.textContent ?? "").not.toContain(RULE);
  });
});

describe("показ пароля иконкой", () => {
  it.each(["login", "register", "reset"] as const)(
    "на экране «%s» переключатель без видимого текста показывает и скрывает введённое",
    async (screen) => {
      await mount(screen);
      const input = container.querySelector<HTMLInputElement>('input[aria-label="Пароль"]');
      expect(input?.type).toBe("password");
      await fill("Пароль", "12345678");

      const toggle = controlByLabel("Показать пароль", container);
      expect(toggle, "переключатель пароля").toBeDefined();
      expect(toggle?.textContent?.trim()).toBe("");
      expect(toggle?.getAttribute("aria-pressed")).toBe("false");

      await click(toggle);
      expect(input?.type).toBe("text");
      expect(input?.value).toBe("12345678");
      expect(toggle?.getAttribute("aria-pressed")).toBe("true");

      await click(toggle);
      expect(input?.type).toBe("password");
      expect(toggle?.getAttribute("aria-pressed")).toBe("false");
    },
  );
});

describe("первый невалидный (UI5)", () => {
  it("короткий пароль на регистрации фокусирует поле пароля и прокручивает к нему", async () => {
    await mount("register");
    await fill("Email", "a@b.test");
    await fill("Пароль", "1234567");
    await fill("Имя", "Анна");
    await fill("Ник", "anna");

    await press("Зарегистрироваться");

    const password = container.querySelector<HTMLInputElement>('input[aria-label="Пароль"]');
    expect(document.activeElement).toBe(password);
    expect(scrollIntoView.mock.instances[0]).toBe(password);
  });

  it("короткий пароль на сбросе фокусирует поле пароля и прокручивает к нему", async () => {
    await mount("reset");
    await fill("Пароль", "1234567");

    await press("Сохранить пароль");

    const password = container.querySelector<HTMLInputElement>('input[aria-label="Пароль"]');
    expect(document.activeElement).toBe(password);
    expect(scrollIntoView.mock.instances[0]).toBe(password);
  });
});
