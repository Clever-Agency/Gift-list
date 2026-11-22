// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { declarationsFor } from "@/test/tamagui-css";
import { SidebarNav } from "./sidebar-nav";

/**
 * The side menu of Story 6.2 (wave C): five sections with the full names, the
 * current root marked with `aria-current`, the friend-request badge and the user
 * card leading to «Профиль». The data of the badge belongs to wave B and arrives
 * as a prop here, so the tests hand it in directly.
 */
const path = vi.hoisted(() => ({ pathname: "/" }));
const navigation = vi.hoisted(() => ({ navigate: vi.fn() }));
const session = vi.hoisted(() => ({
  state: { status: "loading" } as {
    status: "loading" | "anonymous" | "error" | "ready";
    user?: { name: string; nick: string };
  },
}));

vi.mock("@/session/auth-context", () => ({
  useAuth: () => ({
    state: session.state,
    setUser: vi.fn(),
    signOut: vi.fn(async () => ({ ok: true as const })),
    retry: vi.fn(),
  }),
}));
vi.mock("expo-router", () => ({
  router: navigation,
  usePathname: () => path.pathname,
}));
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

  /** The ICU plural of `app.nav.friendsBadge`: «1 запрос / 2 запроса / 5 запросов». */
  function plural(template: string, values?: Record<string, unknown>): string {
    const match = /\{(\w+),\s*plural,\s*([\s\S]*)\}/.exec(template);
    if (!match) return template;
    const count = Number(values?.[match[1] ?? ""] ?? 0);
    const category = new Intl.PluralRules("ru").select(count);
    const variants: Record<string, string> = {};
    for (const variant of (match[2] ?? "").matchAll(/(\w+)\s*\{([^{}]*)\}/g)) {
      variants[variant[1] ?? ""] = variant[2] ?? "";
    }
    const chosen = variants[category] ?? variants.other ?? "";
    return template.replace(match[0], chosen.replace(/#/g, String(count)));
  }

  function lookup(
    catalog: unknown,
    key: string,
    values?: Record<string, unknown>,
  ): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return plural(node, values).replace(/\{(\w+)\}/g, (_, name: string) =>
      String(values?.[name] ?? ""),
    );
  }

  /** `app.nav` resolves the same way `useTranslations` prefixes a namespace. */
  function catalogFor(namespace: string): unknown {
    const [head, ...rest] = namespace.split(".");
    const base = head === "common" ? common : app;
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

const user = { name: "Аня", nick: "anya" };

let root: Root;
let container: HTMLElement;

async function mount(friendsCount?: number | null) {
  await act(async () => {
    root.render(<SidebarNav friendsCount={friendsCount} testID="sidebar-nav" />);
  });
}

function link(href: string): HTMLAnchorElement | null {
  return document.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
}

function card(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="sidebar-nav-user"]');
}

function badge(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="sidebar-nav-friends-badge"]');
}

/**
 * A browser click on a link of the menu. The returned event shows whether the
 * app took the click (`defaultPrevented`) or left it to the browser — that is
 * exactly «перезагрузит страницу или нет».
 */
async function click(node: HTMLElement, init: MouseEventInit = {}): Promise<MouseEvent> {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  await act(async () => {
    node.dispatchEvent(event);
  });
  return event;
}

/** The leaf element that shows exactly this text (the name or the `@ник` line). */
function textNode(text: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>("span, div")).find(
    (node) => node.childElementCount === 0 && node.textContent === text,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  path.pathname = "/";
  session.state = { status: "ready", user };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("SidebarNav", () => {
  it("пять разделов в порядке UX-A13, логотип и landmark «Разделы»", async () => {
    await mount();

    const nav = document.querySelector<HTMLElement>('nav[aria-label="Разделы"]');
    expect(nav).not.toBeNull();
    expect(nav?.textContent).toContain("WishMoon");

    const sections = Array.from(nav?.querySelectorAll("a") ?? []).slice(0, 5);
    expect(sections.map((item) => item.getAttribute("href"))).toEqual([
      "/",
      "/search",
      "/friends",
      "/reservations",
      "/profile",
    ]);
    expect(sections.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Мой вишлист"),
      expect.stringContaining("Поиск"),
      expect.stringContaining("Друзья"),
      expect.stringContaining("Мои брони"),
      expect.stringContaining("Профиль"),
    ]);
  });

  it("активный пункт — только точное совпадение корня", async () => {
    await mount();
    expect(link("/")?.getAttribute("aria-current")).toBe("page");
    expect(link("/search")?.getAttribute("aria-current")).toBeNull();

    path.pathname = "/friends";
    await act(async () => {
      root.render(<SidebarNav testID="sidebar-nav" />);
    });
    expect(link("/friends")?.getAttribute("aria-current")).toBe("page");
    expect(link("/")?.getAttribute("aria-current")).toBeNull();

    // A nested screen lives above the tabs: no section is the current one.
    path.pathname = "/settings";
    await act(async () => {
      root.render(<SidebarNav testID="sidebar-nav" />);
    });
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
  });

  it("badge «Друзья»: число, 99+, подпись с числом", async () => {
    await mount(2);
    expect(link("/friends")?.textContent).toContain("2");
    expect(badge()?.textContent).toBe("2");
    expect(link("/friends")?.getAttribute("aria-label")).toBe("Друзья, 2 запроса");

    await act(async () => {
      root.render(<SidebarNav friendsCount={120} testID="sidebar-nav" />);
    });
    expect(badge()?.textContent).toBe("99+");
    expect(link("/friends")?.getAttribute("aria-label")).toBe("Друзья, 120 запросов");
  });

  it("badge нет при нуле и при отсутствии данных", async () => {
    await mount(0);
    expect(badge()).toBeNull();
    expect(link("/friends")?.getAttribute("aria-label")).toBeNull();

    await act(async () => {
      root.render(<SidebarNav friendsCount={null} testID="sidebar-nav" />);
    });
    expect(badge()).toBeNull();
    expect(link("/friends")?.getAttribute("aria-label")).toBeNull();
  });

  it("карточка пользователя — ссылка в /profile, длинное имя не обрезается", async () => {
    const longName = "Александра-Екатерина Константинопольская";
    session.state = { status: "ready", user: { name: longName, nick: "alexandra" } };
    await mount();

    const node = card();
    expect(node).not.toBeNull();
    expect(node?.tagName).toBe("A");
    expect(node?.getAttribute("href")).toBe("/profile");
    expect(node?.textContent).toContain(longName);
    expect(node?.textContent).toContain("@alexandra");

    const name = textNode(longName);
    expect(name).toBeDefined();
    expect(declarationsFor(name as Element, "text-overflow")).toHaveLength(0);
    expect(declarationsFor(name as Element, "-webkit-line-clamp")).toHaveLength(0);
  });

  it.each(["loading", "anonymous", "error"] as const)(
    "без сессии (%s) меню работает, карточки нет",
    async (status) => {
      session.state = { status };
      await mount();

      expect(link("/")?.getAttribute("href")).toBe("/");
      expect(document.querySelectorAll("nav a")).toHaveLength(5);
      expect(card()).toBeNull();
    },
  );

  it("обычный клик по пункту меню — переход в приложении, без перезагрузки", async () => {
    await mount();

    const event = await click(link("/reservations") as HTMLAnchorElement);

    expect(event.defaultPrevented).toBe(true);
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith("/reservations");
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Cmd", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["средней кнопкой", { button: 1 }],
  ] as const)("клик %s по пункту меню — браузеру, новой вкладке", async (_name, overrides) => {
    await mount();

    const event = await click(link("/friends") as HTMLAnchorElement, overrides);

    expect(event.defaultPrevented).toBe(false);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("обычный клик по карточке пользователя — /profile в приложении", async () => {
    await mount();

    const event = await click(card() as HTMLElement);

    expect(event.defaultPrevented).toBe(true);
    expect(navigation.navigate).toHaveBeenCalledWith("/profile");
  });

  it("Ctrl-клик по карточке пользователя — браузеру", async () => {
    await mount();

    const event = await click(card() as HTMLElement, { ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("displayName совпадает с именем компонента", () => {
    expect(SidebarNav.displayName).toBe("SidebarNav");
  });
});
