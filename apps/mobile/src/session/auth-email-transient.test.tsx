// @vitest-environment happy-dom
import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_EMAIL_CARRY_TTL_MS,
  consumeAuthEmail,
  forgetAuthEmail,
  rememberAuthEmail,
} from "@/session/auth-navigation";
import { click, controlByText, settle, typeInto } from "@/test/dom";
import ForgotScreen from "../../app/(auth)/forgot";
import LoginScreen from "../../app/(auth)/login";
import RegisterScreen from "../../app/(auth)/register";

const EMAIL = "qa+ui@example.test";
const NEXT = "/wishlist/tok_1";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));
const focus = vi.hoisted(() => ({ run: null as null | (() => void) }));

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

  function hrefToString(href: unknown): string {
    if (typeof href === "string") return href;
    if (href && typeof href === "object") {
      const pathname = (href as { pathname?: string }).pathname ?? "";
      const params = (href as { params?: Record<string, string> }).params ?? {};
      const query = new URLSearchParams(params).toString();
      return query ? `${pathname}?${query}` : pathname;
    }
    return "";
  }

  function Link({
    href,
    asChild,
    children,
    onPress,
  }: {
    href: unknown;
    asChild?: boolean;
    children: React.ReactElement<Record<string, unknown>>;
    onPress?: () => void;
  }) {
    function handleClick(event: { preventDefault: () => void }) {
      event.preventDefault();
      onPress?.();
    }

    if (!asChild) {
      return React.createElement("a", { href: hrefToString(href), onClick: handleClick }, children);
    }
    return React.cloneElement(children, { href: hrefToString(href), onClick: handleClick });
  }

  function Screen() {
    return null;
  }

  function useFocusEffect(effect: () => void | (() => void)) {
    React.useEffect(() => {
      focus.run = effect;
      return effect();
    }, [effect]);
  }

  return {
    router: { replace: vi.fn() },
    Stack: { Screen },
    Link,
    useFocusEffect,
    useLocalSearchParams: () => route.params,
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  function SafeAreaView({ children }: { children?: React.ReactNode }) {
    return React.createElement("div", null, children);
  }
  return { SafeAreaView };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

async function mount(Screen: ComponentType) {
  await act(async () => {
    root.render(<Screen />);
  });
}

async function remount(Screen: ComponentType) {
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount(Screen);
}

function input(label: string): HTMLInputElement {
  const node = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!node) throw new Error(`Нет поля «${label}»`);
  return node;
}

function anchors(): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll("a"));
}

function anchorByText(label: string): HTMLAnchorElement {
  const node = anchors().find((anchor) => (anchor.textContent ?? "").includes(label));
  if (!node) throw new Error(`Нет ссылки «${label}»`);
  return node;
}

function expectNoEmail(href: string): void {
  expect(href).not.toContain("email=");
  expect(href).not.toContain(EMAIL);
  expect(href).not.toContain(encodeURIComponent(EMAIL));
  expect(href).not.toContain("@");
  expect(href).not.toContain("%40");
}

beforeEach(() => {
  vi.clearAllMocks();
  route.params = {};
  focus.run = null;
  forgetAuthEmail();
  api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  focus.run = null;
  forgetAuthEmail();
  vi.restoreAllMocks();
});

describe("эфемерный перенос email", () => {
  it("запоминается для цели и забирается один раз", () => {
    rememberAuthEmail("/forgot", EMAIL);

    expect(consumeAuthEmail("/forgot")).toBe(EMAIL);
    expect(consumeAuthEmail("/forgot")).toBe("");
  });

  it("чужой экран не забирает email", () => {
    rememberAuthEmail("/forgot", EMAIL);

    expect(consumeAuthEmail("/login")).toBe("");
    expect(consumeAuthEmail("/forgot")).toBe(EMAIL);
  });

  it("пустое значение сбрасывает ожидающий перенос", () => {
    rememberAuthEmail("/forgot", EMAIL);
    rememberAuthEmail("/forgot", "   ");

    expect(consumeAuthEmail("/forgot")).toBe("");
  });

  it("просроченный перенос не отдаётся", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    rememberAuthEmail("/forgot", EMAIL);
    now.mockReturnValue(1_000 + AUTH_EMAIL_CARRY_TTL_MS + 1);

    expect(consumeAuthEmail("/forgot")).toBe("");
  });
});

describe("ссылки экранов входа", () => {
  it("ссылки входа не содержат email, next сохраняется", async () => {
    route.params = { next: NEXT };
    await mount(LoginScreen);
    await typeInto(input("Email"), EMAIL);

    for (const label of ["Забыли пароль", "Создать аккаунт"]) {
      const href = anchorByText(label).getAttribute("href") ?? "";
      expect(href).toContain("next=%2Fwishlist%2Ftok_1");
      expectNoEmail(href);
    }
  });

  it("ссылка регистрации не содержит email, next сохраняется", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "",
      reason: "EMAIL_TAKEN",
      field: "email",
    });
    route.params = { next: NEXT };
    await mount(RegisterScreen);
    await typeInto(input("Email"), EMAIL);
    await typeInto(input("Пароль"), "12345678");
    await typeInto(input("Имя"), "Анна");
    await typeInto(input("Ник"), "anna");
    await click(controlByText("Зарегистрироваться", container));
    await settle();

    const loginLinks = anchors().filter((anchor) => (anchor.textContent ?? "").includes("Войти"));
    expect(loginLinks.length).toBeGreaterThan(0);
    for (const link of loginLinks) {
      const href = link.getAttribute("href") ?? "";
      expect(href).toContain("next=%2Fwishlist%2Ftok_1");
      expectNoEmail(href);
    }
  });

  it("ссылка сброса пароля не содержит email, next сохраняется", async () => {
    route.params = { next: NEXT };
    await mount(ForgotScreen);
    await typeInto(input("Email"), EMAIL);

    const href = anchorByText("Войти").getAttribute("href") ?? "";
    expect(href).toContain("next=%2Fwishlist%2Ftok_1");
    expectNoEmail(href);
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example"])(
    "опасный next=%s отбрасывается ссылками",
    async (unsafe) => {
      route.params = { next: unsafe };
      await mount(LoginScreen);

      for (const label of ["Забыли пароль", "Создать аккаунт"]) {
        const href = anchorByText(label).getAttribute("href") ?? "";
        expect(href).not.toContain("evil");
        expect(href).not.toContain("next=");
      }
    },
  );

  it("нажатие ссылки не пишет email в адрес и постоянное хранилище", async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    route.params = { next: NEXT };
    await mount(LoginScreen);
    await typeInto(input("Email"), EMAIL);

    await click(anchorByText("Забыли пароль"));

    expect(window.location.search).not.toContain("email");
    expect(window.location.search).not.toContain("@");
    expect(window.location.search).not.toContain("%40");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe("перенос email между экранами", () => {
  it("вход передаёт email в сброс пароля, next остаётся", async () => {
    route.params = { next: NEXT };
    await mount(LoginScreen);
    await typeInto(input("Email"), EMAIL);
    await click(anchorByText("Забыли пароль"));

    await remount(ForgotScreen);
    expect(input("Email").value).toBe(EMAIL);

    const href = anchorByText("Войти").getAttribute("href") ?? "";
    expect(href).toContain("next=%2Fwishlist%2Ftok_1");
    expectNoEmail(href);
  });

  it("вход передаёт email в регистрацию", async () => {
    route.params = {};
    await mount(LoginScreen);
    await typeInto(input("Email"), EMAIL);
    await click(anchorByText("Создать аккаунт"));

    await remount(RegisterScreen);
    expect(input("Email").value).toBe(EMAIL);
  });

  it("регистрация передаёт email в вход, next остаётся", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "",
      reason: "EMAIL_TAKEN",
      field: "email",
    });
    route.params = { next: NEXT };
    await mount(RegisterScreen);
    await typeInto(input("Email"), EMAIL);
    await typeInto(input("Пароль"), "12345678");
    await typeInto(input("Имя"), "Анна");
    await typeInto(input("Ник"), "anna");
    await click(controlByText("Зарегистрироваться", container));
    await settle();
    await click(anchors().find((anchor) => (anchor.textContent ?? "").includes("Войти")));

    await remount(LoginScreen);
    expect(input("Email").value).toBe(EMAIL);
  });

  it("сброс пароля передаёт email обратно на вход", async () => {
    route.params = {};
    await mount(ForgotScreen);
    await typeInto(input("Email"), EMAIL);
    await click(anchorByText("Войти"));

    await remount(LoginScreen);
    expect(input("Email").value).toBe(EMAIL);
  });
});

describe("перезагрузка, глубокий переход и возврат", () => {
  it.each([
    ["вход", LoginScreen],
    ["регистрация", RegisterScreen],
    ["сброс", ForgotScreen],
  ] as const)("глубокий переход с ?email= не заполняет поле (%s)", async (_, Screen) => {
    route.params = { email: EMAIL, next: NEXT };
    await mount(Screen);

    expect(input("Email").value).toBe("");
    expect(consumeAuthEmail("/login")).toBe("");
    expect(consumeAuthEmail("/register")).toBe("");
    expect(consumeAuthEmail("/forgot")).toBe("");
  });

  it("после перезагрузки без переноса поле пустое", async () => {
    rememberAuthEmail("/login", EMAIL);
    route.params = {};
    await mount(LoginScreen);
    expect(input("Email").value).toBe(EMAIL);

    await remount(LoginScreen);
    expect(input("Email").value).toBe("");
    expect(consumeAuthEmail("/login")).toBe("");
  });

  it("при повторном фокусе забирает новый email", async () => {
    route.params = {};
    await mount(LoginScreen);
    expect(input("Email").value).toBe("");

    rememberAuthEmail("/login", EMAIL);
    await act(async () => focus.run?.());

    expect(input("Email").value).toBe(EMAIL);
    expect(consumeAuthEmail("/login")).toBe("");
  });
});

describe("первый невалидный (UI5)", () => {
  it("пустой email на восстановлении фокусирует поле и помечает его ошибкой", async () => {
    await mount(ForgotScreen);

    const submit = Array.from(container.querySelectorAll<HTMLElement>("button")).find((node) =>
      (node.textContent ?? "").includes("Отправить ссылку"),
    );
    expect(submit).toBeDefined();
    await click(submit);

    const email = input("Email");
    expect(document.activeElement).toBe(email);
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent ?? "").toContain("Проверьте введённые данные.");
  });
});
