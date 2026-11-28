// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { controlByText, settle } from "@/test/dom";
import { AuthProvider } from "@/session/auth-context";
import InviteScreen from "../../app/(app)/invite/[token]";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const invites = vi.hoisted(() => ({ getInvitePreview: vi.fn(), acceptInvite: vi.fn() }));
const copier = vi.hoisted(() => ({ copyMyInviteLink: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
}));
const search = vi.hoisted(() => ({
  params: { token: "tok_1" } as Record<string, string | undefined>,
}));

vi.mock("@/api/client", () => api);
vi.mock("@/api/invite-link", () => invites);
vi.mock("@/invite/copy-link", () => copier);
vi.mock("@/platform/session-token", () => ({ clearSessionToken: vi.fn() }));
vi.mock("@/session/device-time-zone", () => ({ deviceTimeZone: () => "Europe/Minsk" }));
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    router: navigation,
    Stack: { Screen: () => null },
    useLocalSearchParams: () => search.params,
    Link: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
    // W12.23: the wide loading state reads the safe area for its window fallback.
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
};

const inviter = { displayName: "Сергей", nick: "sergey" };

let root: Root;
let container: HTMLElement;

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <InviteScreen />
      </AuthProvider>,
    );
  });
  await settle(10);
}

function text(): string {
  return container.textContent ?? "";
}

function control(label: string): HTMLElement | null {
  return controlByText(label, container) ?? null;
}

async function press(label: string) {
  const target = control(label);
  expect(target).not.toBeNull();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

/** The toast's close cross: an icon button, so its name comes from `aria-label`. */
async function dismissToast() {
  const target = container.querySelector<HTMLElement>('[aria-label="Закрыть"]');
  expect(target).not.toBeNull();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}

function readySession() {
  api.apiRequest.mockResolvedValue({ ok: true, data: user });
}

beforeEach(() => {
  vi.resetAllMocks();
  search.params = { token: "tok_1" };
  navigation.canGoBack.mockReturnValue(true);
  invites.getInvitePreview.mockResolvedValue({
    ok: true,
    inviter,
    state: "can_accept",
  });
  invites.acceptInvite.mockResolvedValue({ ok: true, outcome: "FRIENDS" });
  copier.copyMyInviteLink.mockResolvedValue("copied");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("приглашение: гейт сессии", () => {
  it("пока сессия неизвестна, показывает общий экран загрузки, а не пустую страницу", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    const region = container.querySelector('[data-testid="session-loading"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем");
    expect(invites.getInvitePreview).not.toHaveBeenCalled();
  });

  it("аноним уходит на регистрацию с возвратом к приглашению", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/register",
      params: { next: "/invite/tok_1" },
    });
    expect(container.querySelector('[data-testid="session-loading"]')).not.toBeNull();
    expect(invites.getInvitePreview).not.toHaveBeenCalled();
  });

  it("сетевая ошибка сессии даёт «Повторить», а не переход на регистрацию", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    const region = container.querySelector('[data-testid="session-error"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("alert");
    expect(text()).toContain("Нет связи с сервером");
    expect(text()).toContain("Повторить");
  });
});

describe("приглашение: превью", () => {
  it("пока превью в пути, показывает skeleton и не принимает приглашение", async () => {
    readySession();
    invites.getInvitePreview.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(container.querySelector('[data-testid="invite-loading"]')).not.toBeNull();
    expect(invites.getInvitePreview).toHaveBeenCalledWith("tok_1");
    expect(invites.acceptInvite).not.toHaveBeenCalled();
  });

  it("can_accept: «Добавить пользователя «Сергей» в друзья?», Avatar, «Добавить» и «Отмена»", async () => {
    readySession();
    await mount();

    // AD-24: the name is the literal display name, never a declined form.
    expect(text()).toContain("Добавить пользователя «Сергей» в друзья?");
    expect(container.querySelector('[data-testid="invite-avatar"]')?.textContent).toBe("С");
    expect(control("Добавить")).not.toBeNull();
    expect(control("Отмена")).not.toBeNull();
    expect(invites.getInvitePreview).toHaveBeenCalledTimes(1);
    // AD-21: the preview alone never creates the edge.
    expect(invites.acceptInvite).not.toHaveBeenCalled();
  });

  it("«Добавить» вызывает accept ровно один раз, затем toast и профиль", async () => {
    readySession();
    await mount();

    await press("Добавить");

    expect(invites.acceptInvite).toHaveBeenCalledTimes(1);
    expect(invites.acceptInvite).toHaveBeenCalledWith("tok_1");
    expect(text()).toContain("Сергей теперь в друзьях");
    expect(navigation.replace).not.toHaveBeenCalled();

    await dismissToast();
    await settle(200);

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/u/[nick]",
      params: { nick: "sergey" },
    });
  });

  it("повторное нажатие, пока accept в пути, не создаёт второе ребро", async () => {
    readySession();
    let finish: ((value: unknown) => void) | undefined;
    invites.acceptInvite.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await mount();

    await press("Добавить");
    await press("Добавить");

    expect(invites.acceptInvite).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish?.({ ok: true, outcome: "ALREADY_FRIENDS" });
    });
  });

  it("«Отмена» ничего не создаёт и возвращает назад", async () => {
    readySession();
    await mount();

    await press("Отмена");

    expect(invites.acceptInvite).not.toHaveBeenCalled();
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("«Отмена» без истории открывает главный экран", async () => {
    readySession();
    navigation.canGoBack.mockReturnValue(false);
    await mount();

    await press("Отмена");

    expect(invites.acceptInvite).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith("/");
  });

  it("self: своя ссылка с «Скопировать» копирует ссылку-приглашение", async () => {
    readySession();
    invites.getInvitePreview.mockResolvedValue({ ok: true, inviter, state: "self" });
    await mount();

    expect(text()).toContain("Это ваша ссылка-приглашение. Отправьте её друзьям.");
    expect(control("Скопировать")).not.toBeNull();

    await press("Скопировать");

    expect(copier.copyMyInviteLink).toHaveBeenCalledTimes(1);
    expect(text()).toContain("Ссылка-приглашение скопирована");
    expect(invites.acceptInvite).not.toHaveBeenCalled();
  });

  it("self: отказ копирования показывает ошибку, а не успех", async () => {
    readySession();
    invites.getInvitePreview.mockResolvedValue({ ok: true, inviter, state: "self" });
    copier.copyMyInviteLink.mockResolvedValue("failed");
    await mount();

    await press("Скопировать");

    expect(text()).toContain("Не получилось скопировать ссылку. Попробуйте ещё раз.");
    expect(text()).not.toContain("Ссылка-приглашение скопирована");
  });

  it("friends: «Вы уже друзья с Сергеем.» и «Открыть вишлист» ведёт в профиль", async () => {
    readySession();
    invites.getInvitePreview.mockResolvedValue({ ok: true, inviter, state: "friends" });
    await mount();

    expect(text()).toContain("Вы уже друзья с Сергей.");

    await press("Открыть вишлист");

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/u/[nick]",
      params: { nick: "sergey" },
    });
    expect(invites.acceptInvite).not.toHaveBeenCalled();
  });

  it("неизвестный токен и Block: один текст «Приглашение не найдено.» без имени", async () => {
    readySession();
    invites.getInvitePreview.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
    await mount();

    expect(text()).toContain("Приглашение не найдено.");
    expect(text()).not.toContain("Сергей");
    expect(control("Мой вишлист")).toBeNull();
    expect(container.querySelector("a")?.textContent).toContain("Мой вишлист");
    expect(invites.acceptInvite).not.toHaveBeenCalled();
  });

  it("сеть при загрузке: toast «Нет сети…», экран повтора и повторное чтение", async () => {
    readySession();
    invites.getInvitePreview.mockResolvedValue({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Нет сети. Попробуйте ещё раз.");
    expect(container.querySelector('[data-testid="invite-error"]')).not.toBeNull();

    await press("Повторить");

    expect(invites.getInvitePreview).toHaveBeenCalledTimes(2);
  });

  it("битый сегмент токена — общий 404 приложения без запроса превью", async () => {
    readySession();
    search.params = { token: "../admin" };
    await mount();

    expect(container.querySelector('[data-testid="not-found-page"]')).not.toBeNull();
    expect(invites.getInvitePreview).not.toHaveBeenCalled();
  });
});
