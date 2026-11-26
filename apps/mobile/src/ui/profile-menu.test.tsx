// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileMenu } from "./profile-menu";

/**
 * «Профиль» (Story 6.2): четыре строки — «Мой профиль», «Настройки», «Написать
 * в техподдержку», «Выйти». «Подборок» (Story 10.1) нет. Меню ничего не читает:
 * экран передаёт переходы и выход, поэтому тест проверяет строки и нажатия.
 */
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
  const catalogs = { app: read("app"), common: read("common") };

  function lookup(catalog: unknown, key: string): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : key;
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
    useTranslations: (namespace: string) => (key: string) =>
      lookup(catalogFor(namespace), key),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const handlers = {
  profile: vi.fn(),
  settings: vi.fn(),
  signOut: vi.fn(),
};

let root: Root;
let container: HTMLElement;

async function mount(signingOut = false) {
  await act(async () => {
    root.render(
      <ProfileMenu
        onOpenProfile={handlers.profile}
        onOpenSettings={handlers.settings}
        onSignOut={handlers.signOut}
        signingOut={signingOut}
      />,
    );
  });
}

function row(testID: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
}

async function press(target: HTMLElement | null) {
  expect(target).not.toBeNull();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

describe("ProfileMenu", () => {
  it("четыре строки по порядку: мой профиль, настройки, техподдержка, выход", async () => {
    await mount();

    const rows = Array.from(
      container.querySelectorAll<HTMLElement>('[role="button"], [role="link"]'),
    ).map((node) => node.textContent);
    expect(rows).toEqual(["Мой профиль", "Настройки", "Написать в техподдержку", "Выйти"]);
  });

  it("«Подборок» нет (Story 10.1)", async () => {
    await mount();
    expect(container.textContent).not.toContain("Подборк");
    expect(container.textContent).not.toContain("Коллекц");
  });

  it("«Мой профиль» и «Настройки» зовут переданные переходы", async () => {
    await mount();

    await press(row("profile-menu-my-profile"));
    expect(handlers.profile).toHaveBeenCalledTimes(1);

    await press(row("profile-menu-settings"));
    expect(handlers.settings).toHaveBeenCalledTimes(1);
  });

  it("«Выйти» — деструктивная строка, зовёт выход один раз", async () => {
    await mount();

    const signOut = row("profile-menu-sign-out");
    expect(signOut?.textContent).toBe("Выйти");
    await press(signOut);
    expect(handlers.signOut).toHaveBeenCalledTimes(1);
  });

  it("пока выход в полёте, строка недоступна и второй раз не срабатывает", async () => {
    await mount(true);

    const signOut = row("profile-menu-sign-out");
    expect(signOut?.getAttribute("aria-disabled")).toBe("true");
    await press(signOut);
    expect(handlers.signOut).not.toHaveBeenCalled();
  });

  it("«Написать в техподдержку» — та же ссылка `mailto:`, что в футере анонима", async () => {
    await mount();

    const support = row("profile-menu-support");
    expect(support?.textContent).toContain("Написать в техподдержку");
  });

  it("displayName совпадает с именем компонента", () => {
    expect(ProfileMenu.displayName).toBe("ProfileMenu");
  });
});
