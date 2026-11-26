// @vitest-environment happy-dom
import { getMessages } from "@gift-list/contracts";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveSectionProvider } from "./active-section";
import { AppFrame } from "./app-frame";

/**
 * AD-30 / D-50: one shell on every signed-in screen. The frame decides the
 * navigation from the session (an anonymous visitor gets none), and the selected
 * item from the path (`useActiveSection`). The route scope — that `/settings`,
 * `/gifts/*`, `/u/*`, `/wishlist/*`, `/invite/*` and `/notifications` live inside
 * `(app)`, while login and the other anonymous screens do not — is fixed by the
 * file tree in the second block.
 */
const path = vi.hoisted(() => ({ pathname: "/" }));
const navigation = vi.hoisted(() => ({ navigate: vi.fn() }));
const session = vi.hoisted(() => ({
  state: { status: "ready" } as {
    status: "loading" | "anonymous" | "error" | "ready";
    user?: { id: string; name: string; nick: string };
  },
}));

vi.mock("expo-router", () => ({
  router: navigation,
  usePathname: () => path.pathname,
}));
vi.mock("@/session/auth-context", () => ({
  useAuth: () => ({
    state: session.state,
    setUser: vi.fn(),
    signOut: vi.fn(async () => ({ ok: true as const })),
    retry: vi.fn(),
  }),
}));
// The frame reads the invite count through the optional hook; the badge itself
// is exercised by `invite-badge.test.tsx` and is not the subject here.
vi.mock("@/navigation/invite-badge", () => ({
  useInviteBadgeOptional: () => null,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = { id: "u1", name: "Аня", nick: "anya" };
const appDir = join(dirname(fileURLToPath(import.meta.url)), "../../app");

let root: Root;
let container: HTMLElement;

async function mount(frame: React.ReactNode) {
  await act(async () => {
    root.render(
      <IntlProvider locale="ru" messages={getMessages("ru")}>
        {frame}
      </IntlProvider>,
    );
  });
}

function link(href: string): HTMLAnchorElement | null {
  return document.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
}

function tabBar(): HTMLElement | null {
  return document.querySelector("[data-testid='app-tab-bar']");
}

function sidebar(): HTMLElement | null {
  return document.querySelector("nav[aria-label='Разделы']");
}

/** The hrefs of the items currently marked `aria-current` inside a navigation. */
function selectedIn(nav: ParentNode | null): string[] {
  return Array.from(nav?.querySelectorAll<HTMLElement>('[aria-current="page"]') ?? []).map(
    (node) => node.getAttribute("href") ?? "",
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
  await act(async () => root.unmount());
  container.remove();
});

describe("AppFrame: оболочка вошедшего", () => {
  it("на корне видны и меню, и нижние вкладки; выбран «Вишлист»", async () => {
    await mount(
      <AppFrame>
        <span data-testid="content" />
      </AppFrame>,
    );

    expect(container.querySelector("[data-testid='content']")).not.toBeNull();
    expect(sidebar()).not.toBeNull();
    expect(tabBar()).not.toBeNull();
    expect(
      Array.from(tabBar()?.querySelectorAll("a") ?? []).map((item) => item.getAttribute("href")),
    ).toEqual(["/", "/search", "/friends", "/reservations", "/profile"]);
    expect(selectedIn(tabBar())).toEqual(["/"]);
    expect(selectedIn(sidebar())).toEqual(["/"]);
  });

  it.each([
    ["/u/anya", "/friends"],
    ["/settings", "/profile"],
    ["/gifts/new", "/"],
    ["/gifts/gift-1", "/"],
    ["/gifts/gift-1/edit", "/"],
    ["/wishlist/tok-1", "/"],
    ["/invite/tok-1", "/friends"],
  ])("прямой вход на %s: подсвечен %s", async (pathname, href) => {
    path.pathname = pathname;
    await mount(
      <AppFrame>
        <span />
      </AppFrame>,
    );

    expect(selectedIn(tabBar())).toEqual([href]);
    expect(selectedIn(sidebar())).toEqual([href]);
  });

  it("вложенный экран, открытый из «Друзей», оставляет подсвеченными «Друзей»", async () => {
    path.pathname = "/friends";
    await mount(
      <ActiveSectionProvider>
        <AppFrame>
          <span />
        </AppFrame>
      </ActiveSectionProvider>,
    );
    expect(selectedIn(tabBar())).toEqual(["/friends"]);

    path.pathname = "/gifts/gift-1";
    await mount(
      <ActiveSectionProvider>
        <AppFrame>
          <span />
        </AppFrame>
      </ActiveSectionProvider>,
    );
    expect(selectedIn(tabBar())).toEqual(["/friends"]);
    expect(selectedIn(sidebar())).toEqual(["/friends"]);
  });

  it("«Уведомления»: выбран пункт меню, ни одна вкладка снизу — нет", async () => {
    path.pathname = "/notifications";
    await mount(
      <AppFrame>
        <span />
      </AppFrame>,
    );

    expect(selectedIn(tabBar())).toEqual([]);
    expect(selectedIn(sidebar())).toEqual(["/notifications"]);
    expect(link("/notifications")?.textContent).toContain("Уведомления");
  });

  it.each(["anonymous", "loading"] as const)(
    "без подтверждённого входа (%s) навигации нет, содержимое на месте",
    async (status) => {
      session.state = { status };
      await mount(
        <AppFrame>
          <span data-testid="content" />
        </AppFrame>,
      );

      expect(container.querySelector("[data-testid='content']")).not.toBeNull();
      expect(sidebar()).toBeNull();
      expect(tabBar()).toBeNull();
    },
  );

  it("ошибка чтения сессии — не выход: навигация остаётся", async () => {
    session.state = { status: "error" };
    await mount(
      <AppFrame>
        <span />
      </AppFrame>,
    );

    expect(sidebar()).not.toBeNull();
    expect(tabBar()).not.toBeNull();
  });
});

describe("стек (app) и экраны без входа", () => {
  it("оболочка одна и она вокруг всего стека (app)", () => {
    const layout = readFileSync(join(appDir, "(app)/_layout.tsx"), "utf8");
    expect(layout).toContain("<AppFrame>");
    expect(layout).toContain("<Stack");
    expect(layout).toContain('anchor: "(tabs)"');
  });

  it.each([
    "(tabs)/index",
    "(tabs)/search",
    "(tabs)/friends",
    "(tabs)/reservations",
    "(tabs)/profile",
    "settings",
    "notifications",
    "gifts/new",
    "gifts/[id]/index",
    "gifts/[id]/edit",
    "u/[nick]",
    "invite/[token]",
  ])("экран вошедшего %s лежит внутри (app)", (relative) => {
    expect(existsSync(join(appDir, "(app)", `${relative}.tsx`))).toBe(true);
  });

  it("публичные экраны ссылки получают ту же оболочку в группе (link)", () => {
    const layout = readFileSync(join(appDir, "(link)/_layout.tsx"), "utf8");
    expect(layout).toContain("<AppFrame>");
    // No `(tabs)` anchor: a guest who presses «назад» must not land on the
    // signed-in wishlist tab and be sent to login.
    expect(layout).not.toContain("unstable_settings");
    expect(existsSync(join(appDir, "(link)/wishlist/[token].tsx"))).toBe(true);
    // The invite always signs a guest up first, so it keeps the `(app)` anchor.
    expect(existsSync(join(appDir, "(app)/invite/[token].tsx"))).toBe(true);
    expect(existsSync(join(appDir, "(link)/invite"))).toBe(false);
  });

  it.each(["login", "register", "forgot", "reset"])(
    "экран без входа %s лежит вне (app) и не рисует оболочку",
    (name) => {
      const file = join(appDir, "(auth)", `${name}.tsx`);
      expect(existsSync(file)).toBe(true);
      expect(existsSync(join(appDir, "(app)", `${name}.tsx`))).toBe(false);
      expect(readFileSync(file, "utf8")).not.toContain("AppFrame");
    },
  );
});
