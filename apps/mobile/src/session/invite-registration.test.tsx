// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "expo-router";
import { click, controlByText, typeInto } from "@/test/dom";
import RegisterScreen from "../../app/(auth)/register";

/**
 * AD-21 / AD-15-11: only a registration that came from `/invite/{token}` sends
 * the token; a list link (`/l/:token`, already rewritten to `/wishlist/:token`)
 * and every other return path stay token-free.
 */
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));
const session = vi.hoisted(() => ({
  user: null as {
    id: string;
    email: string;
    name: string;
    nick: string;
    timeZone: null;
  } | null,
  listeners: new Set<() => void>(),
}));

vi.mock("@/api/client", () => api);
vi.mock("@/session/auth-context", async () => {
  const React = await import("react");
  return {
    useAuth() {
      const [, bump] = React.useState(0);
      React.useEffect(function subscribeToSession() {
        function notify() {
          bump((value) => value + 1);
        }
        session.listeners.add(notify);
        return function unsubscribe() {
          session.listeners.delete(notify);
        };
      }, [bump]);
      return {
        state: session.user
          ? { status: "ready" as const, user: session.user }
          : { status: "anonymous" as const },
        getSessionRevision: vi.fn(() => 0),
        setUser(user: NonNullable<typeof session.user>) {
          session.user = user;
          for (const notify of session.listeners) notify();
        },
        signOut: vi.fn(async () => ({ ok: true as const })),
      };
    },
  };
});
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
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

  function lookup(catalog: Record<string, unknown>, key: string): string {
    let node: unknown = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : key;
  }

  return {
    useTranslations: (namespace: string) => (key: string) =>
      lookup(namespace === "common" ? common : app, key),
    useLocale: () => "ru",
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

async function fill(label: string, value: string) {
  await typeInto(field(label), value);
}

async function mount() {
  await act(async () => {
    root.render(<RegisterScreen />);
  });
}

function bodyOf(call: unknown[]): Record<string, unknown> {
  const init = call[1] as { body?: Record<string, unknown> };
  return init.body ?? {};
}

beforeEach(() => {
  vi.resetAllMocks();
  session.user = null;
  session.listeners.clear();
  route.params = {};
  api.apiRequest.mockResolvedValue({
    ok: true,
    data: {
      user: { id: "u1", email: "a@b.test", name: "Анна", nick: "anna", timeZone: null },
      next: "/",
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function createAccount() {
  await fill("Email", "a@b.test");
  await fill("Пароль", "password1234");
  await fill("Повторите пароль", "password1234");
  await fill("Имя", "Анна");
  await fill("Ник", "anna");
  const submit = controlByText("Зарегистрироваться", container);
  expect(submit).toBeTruthy();
  await click(submit);
}

describe("регистрация по приглашению", () => {
  it("next=/invite/{token}: тело несёт inviteToken", async () => {
    route.params = { next: "/invite/tok_1" };
    await mount();
    await createAccount();

    expect(api.apiRequest).toHaveBeenCalledTimes(1);
    expect(bodyOf(api.apiRequest.mock.calls[0])).toMatchObject({
      next: "/invite/tok_1",
      inviteToken: "tok_1",
    });
  });

  it("next списка: inviteToken не отправляется (AD-15-11)", async () => {
    route.params = { next: "/l/tok_1" };
    await mount();
    await createAccount();

    const body = bodyOf(api.apiRequest.mock.calls[0]);
    expect(body.next).toBe("/wishlist/tok_1");
    expect("inviteToken" in body).toBe(false);
  });

  it("без next токен не отправляется", async () => {
    await mount();
    await createAccount();

    const body = bodyOf(api.apiRequest.mock.calls[0]);
    expect(body.next).toBe("/");
    expect("inviteToken" in body).toBe(false);
  });

  it("после регистрации идёт на «Мой вишлист», если сервер вернул / (CLE-99)", async () => {
    route.params = { next: "/invite/tok_1" };
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: {
        user: { id: "u1", email: "a@b.test", name: "Анна", nick: "anna", timeZone: null },
        next: "/",
      },
    });
    await mount();
    await createAccount();

    expect(router.replace).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalledWith("/invite/tok_1");
    expect(router.replace).toHaveBeenLastCalledWith("/");
  });

  it("после регистрации с дружбой остаётся на экране приглашения (CLE-99)", async () => {
    route.params = { next: "/invite/tok_1" };
    api.apiRequest.mockResolvedValue({
      ok: true,
      data: {
        user: { id: "u1", email: "a@b.test", name: "Анна", nick: "anna", timeZone: null },
        next: "/invite/tok_1",
      },
    });
    await mount();
    await createAccount();

    expect(router.replace).toHaveBeenLastCalledWith("/invite/tok_1");
  });
});
