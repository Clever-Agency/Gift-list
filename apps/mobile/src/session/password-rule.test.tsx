// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginScreen from "../../app/(auth)/login";
import RegisterScreen from "../../app/(auth)/register";
import ResetScreen from "../../app/(auth)/reset";

const RULE = "Минимум 8 символов";
const GENERIC = "Проверьте введённые данные.";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));
const fields = vi.hoisted(() => ({
  change: new Map<string, (value: string) => void>(),
}));

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
    useLocalSearchParams: () => route.params,
  };
});
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({
      children,
      style,
      accessibilityRole,
    }: {
      children?: React.ReactNode;
      style?: { color?: string };
      accessibilityRole?: string;
    }) =>
      React.createElement(
        "span",
        {
          "data-tone": style?.color === "#B42318" ? "error" : style?.color === "#5C6358" ? "hint" : undefined,
          role: accessibilityRole,
        },
        children,
      ),
    View: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
    ScrollView: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
    TextInput: ({
      accessibilityLabel,
      accessibilityHint,
      onChangeText,
    }: {
      accessibilityLabel?: string;
      accessibilityHint?: string;
      onChangeText?: (value: string) => void;
    }) => {
      if (accessibilityLabel && onChangeText) fields.change.set(accessibilityLabel, onChangeText);
      return React.createElement("input", {
        "aria-label": accessibilityLabel,
        "aria-description": accessibilityHint,
      });
    },
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        "button",
        { type: "button", "aria-label": accessibilityLabel, onClick: () => onPress?.() },
        children,
      ),
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

function toneText(tone: "hint" | "error"): string {
  return Array.from(container.querySelectorAll(`span[data-tone="${tone}"]`))
    .map((node) => node.textContent ?? "")
    .join("\n");
}

async function mount(screen: "register" | "reset" | "login") {
  route.params = screen === "reset" ? { token: "live-token" } : {};
  fields.change.clear();
  const Screen = screen === "register" ? RegisterScreen : screen === "reset" ? ResetScreen : LoginScreen;
  await act(async () => {
    root.render(<Screen />);
  });
}

async function fill(label: string, value: string) {
  const change = fields.change.get(label);
  expect(change).toBeTypeOf("function");
  await act(async () => {
    change?.(value);
  });
}

async function press(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((node) =>
    node.textContent?.includes(label),
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
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

describe("требование к паролю", () => {
  it("на регистрации короткий пароль показывает подсказку, а после отправки — ошибку поля", async () => {
    await mount("register");
    expect(toneText("hint")).toContain(RULE);
    expect(toneText("error")).not.toContain(RULE);
    expect(container.querySelector('input[aria-label="Пароль"]')?.getAttribute("aria-description")).toBe(RULE);

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
    expect(container.querySelector('span[role="alert"]')?.textContent).toContain(RULE);
  });

  it("на регистрации пароль длиннее 128 символов не называет минимум", async () => {
    await mount("register");
    await fill("Email", "a@b.test");
    await fill("Пароль", "x".repeat(129));
    await fill("Имя", "Анна");
    await fill("Ник", "anna");
    expect(toneText("hint")).not.toContain(RULE);

    await press("Зарегистрироваться");
    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(toneText("error")).toContain(GENERIC);
    expect(toneText("error")).not.toContain(RULE);
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
    expect(toneText("hint")).toContain(RULE);
    expect(container.querySelector('input[aria-label="Пароль"]')?.getAttribute("aria-description")).toBe(RULE);

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

  it("на входе требование к новому паролю не показывается", async () => {
    await mount("login");
    expect(container.textContent ?? "").not.toContain(RULE);
    await fill("Пароль", "1234567");
    expect(container.textContent ?? "").not.toContain(RULE);
  });
});
