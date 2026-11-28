// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

/**
 * `@tamagui/web` captures `window.matchMedia` when it is first imported, so the
 * controllable mock has to be installed before the imports below (hence
 * `vi.hoisted`). It answers the real breakpoint queries of the package config:
 * `(min-width: 600px)`, `(min-width: 1024px)` and `(min-width: 1280px)`.
 */
const windowMedia = vi.hoisted(() => {
  let width = 360;
  const listeners = new Set<() => void>();

  function matches(query: string): boolean {
    const found = /min-width:\s*(\d+)px/.exec(query);
    if (!found) return false;
    return width >= Number(found[1]);
  }

  function matchMedia(query: string) {
    return {
      media: query,
      get matches() {
        return matches(query);
      },
      addListener(listener: () => void) {
        listeners.add(listener);
      },
      removeListener(listener: () => void) {
        listeners.delete(listener);
      },
      addEventListener(_: string, listener: () => void) {
        listeners.add(listener);
      },
      removeEventListener(_: string, listener: () => void) {
        listeners.delete(listener);
      },
      dispatchEvent() {
        return false;
      },
      onchange: null,
    };
  }

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    setWidth(value: number) {
      width = value;
      for (const listener of [...listeners]) listener();
    },
  };
});

import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { AppShell, useTabBarInset } from "./app-shell";
import { NavItem } from "./nav-item";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";
import { Text } from "./text";
import { spacing } from "./tokens";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

function InsetProbe() {
  return <span data-testid="inset">{useTabBarInset()}</span>;
}

InsetProbe.displayName = "InsetProbe";

function ShellStory() {
  return (
    <AppShell
      testID="shell"
      skipLabel="Перейти к содержимому"
      sidebar={
        <Sidebar brand="Подарки" label="Разделы" testID="sidebar">
          <NavItem variant="side" label="Мой вишлист" icon={<Heart />} selected href="/" />
          <NavItem variant="side" label="Поиск" icon={<Search />} selected={false} href="/search" />
          <NavItem
            variant="side"
            label="Друзья"
            secondary="Друзья, 2 запроса"
            icon={<Users />}
            badge={2}
            selected={false}
            href="/friends"
          />
          <NavItem
            variant="side"
            label="Мои брони"
            icon={<CalendarCheck />}
            selected={false}
            href="/reservations"
          />
          <NavItem variant="side" label="Профиль" icon={<User />} selected={false} href="/profile" />
        </Sidebar>
      }
      tabBar={
        <TabBar label="Разделы" testID="tab-bar">
          <NavItem label="Вишлист" icon={<Heart />} selected href="/" />
          <NavItem label="Поиск" icon={<Search />} selected={false} href="/search" />
          <NavItem label="Друзья" icon={<Users />} badge={2} selected={false} href="/friends" />
          <NavItem label="Брони" icon={<CalendarCheck />} selected={false} href="/reservations" />
          <NavItem label="Профиль" icon={<User />} selected={false} href="/profile" />
        </TabBar>
      }
    >
      <Text>Содержимое раздела</Text>
      <InsetProbe />
    </AppShell>
  );
}

ShellStory.displayName = "ShellStory";

describe("AppShell (compact и medium)", () => {
  it("skip-link первым, один main#main-content, вкладки снизу и высота 56", async () => {
    windowMedia.setWidth(360);
    const { container, render } = mounted();
    await render(<ShellStory />);

    const root = container.querySelector<HTMLElement>("[data-testid='shell']") as HTMLElement;
    expect(root.firstElementChild?.tagName).toBe("A");
    expect(root.firstElementChild?.getAttribute("href")).toBe("#main-content");

    const mains = container.querySelectorAll("main#main-content");
    expect(mains).toHaveLength(1);
    expect(mains[0].getAttribute("tabindex")).toBe("-1");
    expect(mains[0].textContent).toContain("Содержимое раздела");

    // No side menu below 1024 px; the bar is under the content.
    expect(container.querySelector("[data-testid='shell-sidebar']")).toBeNull();
    const barSlot = container.querySelector<HTMLElement>("[data-testid='shell-tab-bar']") as HTMLElement;
    expect(barSlot).not.toBeNull();
    expect(declarationsFor(barSlot, "display").map((one) => one.value)).not.toContain("none");
    expect(barSlot.textContent).toContain("Вишлист");

    expect(container.querySelector("[data-testid='inset']")?.textContent).toBe("56");
  });
});

function AnonymousStory() {
  return (
    <AppShell testID="shell" skipLabel="Перейти к содержимому">
      <Text>Содержимое без навигации</Text>
      <InsetProbe />
    </AppShell>
  );
}

AnonymousStory.displayName = "AnonymousStory";

describe("AppShell без навигации (экран без входа)", () => {
  it("нет ни меню, ни вкладок, и высота панели — 0", async () => {
    windowMedia.setWidth(360);
    const { container, render } = mounted();
    await render(<AnonymousStory />);

    expect(container.querySelector("[data-testid='shell-sidebar']")).toBeNull();
    expect(container.querySelector("[data-testid='shell-tab-bar']")?.textContent).toBe("");
    expect(container.querySelector("[data-testid='inset']")?.textContent).toBe("0");
    expect(container.querySelectorAll("main#main-content")).toHaveLength(1);
  });
});

describe("AppShell (expanded)", () => {
  it("от 1024 px: меню 264 слева, вкладки скрыты, но остаются в дереве", async () => {
    windowMedia.setWidth(1280);
    const { container, render } = mounted();
    await render(<ShellStory />);

    const sidebarSlot = container.querySelector<HTMLElement>("[data-testid='shell-sidebar']");
    expect(sidebarSlot).not.toBeNull();
    const sidebar = container.querySelector<HTMLElement>("[data-testid='sidebar']") as HTMLElement;
    expect(sidebar.getAttribute("aria-label")).toBe("Разделы");
    expect(declarationsFor(sidebar, "width").map((one) => one.value)).toContain(
      "var(--t-size-sidebar)",
    );
    expect(spacing.sidebar).toBe(264);

    // The bar is hidden by style, not unmounted: its TabList routes stay registered.
    const barSlot = container.querySelector<HTMLElement>("[data-testid='shell-tab-bar']") as HTMLElement;
    expect(declarationsFor(barSlot, "display").map((one) => one.value)).toContain("none");
    expect(container.textContent).toContain("Вишлист");

    expect(container.querySelectorAll("main#main-content")).toHaveLength(1);
    expect(container.querySelector("[data-testid='inset']")?.textContent).toBe("0");
  });
});

describe("имена", () => {
  it("displayName совпадает с именем компонента", () => {
    expect(AppShell.displayName).toBe("AppShell");
  });
});
