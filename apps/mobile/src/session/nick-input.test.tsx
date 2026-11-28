// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, controlByText, typeInto } from "@/test/dom";
import RegisterScreen from "../../app/(auth)/register";

/**
 * The nick field of registration: a character reason is shown while typing, a
 * length reason only once the field is settled (blur or submit), and a valid
 * nickname keeps the `@ник` preview. Settings has the same field, see
 * `settings-screen.test.tsx`.
 */
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));

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

function nickInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Ник"]');
  expect(input, "поле «Ник»").not.toBeNull();
  return input as HTMLInputElement;
}

/** The line the field is described by: its error or the `@ник` preview. */
function nickText(): string {
  const id = nickInput().getAttribute("aria-describedby");
  return (id ? document.getElementById(id)?.textContent : "") ?? "";
}

async function fill(label: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input, `поле «${label}»`).not.toBeNull();
  await typeInto(input as HTMLInputElement, value);
}

/** React listens to focus through the bubbling `focusout`. */
async function blurNick() {
  await act(async () => {
    nickInput().dispatchEvent(new Event("focusout", { bubbles: true }));
  });
}

async function press(label: string) {
  const button = controlByText(label, container);
  expect(button, `кнопка «${label}»`).toBeTruthy();
  await click(button);
}

beforeEach(async () => {
  vi.clearAllMocks();
  route.params = {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<RegisterScreen />);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("регистрация: ник", () => {
  it("пустое поле во время ввода ошибкой не считается", () => {
    expect(nickText()).toBe("");
  });

  it("кириллица сразу: причина под полем, превью скрыто", async () => {
    await fill("Ник", "аня");

    expect(nickText()).toBe("Ник пишется латиницей — без русских букв");
  });

  it("пробел сразу: под полем причина, превью скрыто", async () => {
    await fill("Ник", "an na");

    expect(nickText()).toBe("В нике не может быть пробелов");
  });

  it("запрещённый символ сразу: назван этот символ", async () => {
    await fill("Ник", "an#a");

    expect(nickText()).toBe(
      "Символ «#» нельзя использовать. Подойдут латинские буквы, цифры и _",
    );
  });

  it("короткий ник: ошибка только после blur", async () => {
    await fill("Ник", "ab");
    expect(nickText()).not.toContain("не короче");

    await blurNick();
    expect(nickText()).toBe("Ник должен быть не короче 3 символов");
  });

  it("короткий ник при отправке: ошибка под полем, запрос не уходит", async () => {
    await fill("Email", "a@b.test");
    await fill("Пароль", "password1234");
    await fill("Повторите пароль", "password1234");
    await fill("Имя", "Аня");
    await fill("Ник", "ab");

    await press("Зарегистрироваться");

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(nickText()).toBe("Ник должен быть не короче 3 символов");
  });

  it("пробелы по краям не дают отправить форму, хотя схема их обрезает", async () => {
    await fill("Email", "a@b.test");
    await fill("Пароль", "password1234");
    await fill("Повторите пароль", "password1234");
    await fill("Имя", "Аня");
    await fill("Ник", " anna ");

    await press("Зарегистрироваться");

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(nickText()).toBe("В нике не может быть пробелов");
  });

  it("корректный ник: превью, заглавные приводятся к нижнему регистру", async () => {
    await fill("Ник", "New_Nick");

    expect(nickText()).toBe("@new_nick");
    expect(nickInput().getAttribute("aria-invalid")).not.toBe("true");
  });
});
