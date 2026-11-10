// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, controlByText, typeInto } from "@/test/dom";
import ForgotScreen from "../../app/(auth)/forgot";
import LoginScreen from "../../app/(auth)/login";
import RegisterScreen from "../../app/(auth)/register";

/**
 * `EMAIL_MAX` (254) belongs to registration only: it caps an address the service
 * creates. Sign-in and password reset only look an existing address up, so a
 * legacy account with a longer one must still be able to enter it — the client
 * neither caps nor cuts these fields.
 */
const DOMAIN = "@example.com";
const MAX_EMAIL = `${"a".repeat(254 - DOMAIN.length)}${DOMAIN}`;
const OVER_MAX_EMAIL = `${"a".repeat(255 - DOMAIN.length)}${DOMAIN}`;
const LEGACY_EMAIL = `${"a".repeat(300 - DOMAIN.length)}${DOMAIN}`;

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));

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

const GENERIC = "Проверьте введённые данные.";

let root: Root;
let container: HTMLElement;

async function mount(screen: "register" | "login" | "forgot") {
  const Screen = screen === "register" ? RegisterScreen : screen === "login" ? LoginScreen : ForgotScreen;
  await act(async () => {
    root.render(<Screen />);
  });
}

function emailInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Email"]');
  expect(input, "поле «Email»").not.toBeNull();
  return input as HTMLInputElement;
}

async function fill(label: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, `поле «${label}»`).not.toBeNull();
  await typeInto(input as HTMLInputElement, value);
}

async function press(label: string) {
  const button = controlByText(label, container);
  expect(button, `кнопка «${label}»`).toBeTruthy();
  await click(button);
}

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("почта: 254 только на регистрации", () => {
  it("регистрация принимает 254 и отвергает 255, не обрезая поле", async () => {
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: {
        user: { id: "u1", email: MAX_EMAIL, name: "Анна", nick: "anna", timeZone: null },
        next: "/",
      },
    });
    await mount("register");
    // No `maxLength`: a cap in UTF-16 units would cut an address the schema takes.
    expect(emailInput().hasAttribute("maxlength")).toBe(false);

    await fill("Email", MAX_EMAIL);
    await fill("Пароль", "12345678");
    await fill("Имя", "Анна");
    await fill("Ник", "anna");
    expect(emailInput().value).toBe(MAX_EMAIL);
    await press("Зарегистрироваться");

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/api/v1/register",
      expect.objectContaining({ body: expect.objectContaining({ email: MAX_EMAIL }) }),
    );
  });

  it("регистрация с 255 называет поле email и не отправляет", async () => {
    await mount("register");
    await fill("Email", OVER_MAX_EMAIL);
    await fill("Пароль", "12345678");
    await fill("Имя", "Анна");
    await fill("Ник", "anna");

    await press("Зарегистрироваться");

    expect(api.apiRequest).not.toHaveBeenCalled();
    const described = emailInput().getAttribute("aria-describedby");
    expect((described ? document.getElementById(described)?.textContent : "") ?? "").toContain(
      GENERIC,
    );
  });

  it("вход принимает legacy-адрес длиннее 254 и отправляет его целиком", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Invalid credentials",
    });
    await mount("login");
    expect(emailInput().hasAttribute("maxlength")).toBe(false);

    await fill("Email", LEGACY_EMAIL);
    await fill("Пароль", "12345678");
    await press("Войти");

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/api/v1/session",
      expect.objectContaining({ body: expect.objectContaining({ email: LEGACY_EMAIL }) }),
    );
  });

  it("сброс пароля принимает legacy-адрес длиннее 254 и отправляет его целиком", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: { accepted: true } });
    await mount("forgot");
    expect(emailInput().hasAttribute("maxlength")).toBe(false);

    await fill("Email", LEGACY_EMAIL);
    await press("Отправить ссылку");

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/api/v1/password/forgot",
      expect.objectContaining({ body: expect.objectContaining({ email: LEGACY_EMAIL }) }),
    );
  });
});
