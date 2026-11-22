// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";
import { CalendarCheck, Heart, Search, User, Users } from "./icons";
import { NavItem } from "./nav-item";
import { TabBar } from "./tab-bar";
import tabBarNativeSource from "./tab-bar.native.tsx?raw";
import { spacing } from "./tokens";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

describe("TabBar", () => {
  it("web: landmark nav «Разделы» со ссылками и полосой 1 px сверху", async () => {
    const { container, render } = mounted();
    await render(
      <TabBar label="Разделы" testID="tabs">
        <NavItem label="Вишлист" icon={<Heart />} selected href="/" />
        <NavItem label="Поиск" icon={<Search />} selected={false} href="/search" />
      </TabBar>,
    );

    const nav = container.querySelector<HTMLElement>("nav[aria-label='Разделы']");
    expect(nav).not.toBeNull();
    expect(nav?.querySelectorAll("a")).toHaveLength(2);
    expect(declarationsFor(nav as HTMLElement, "min-height").map((one) => one.value)).toContain(
      "var(--t-size-tab-bar)",
    );
    expect(spacing["tab-bar"]).toBe(56);
    expect(declarationsFor(nav as HTMLElement, "border-top-width").map((one) => one.value)).toContain(
      "1px",
    );
    expect(declarationsFor(nav as HTMLElement, "border-color").map((one) => one.value)).toContain(
      "var(--border)",
    );
    expect(declarationsFor(nav as HTMLElement, "background-color").map((one) => one.value)).toContain(
      "var(--surface)",
    );
  });

  it("пять разделов в порядке UX-A13, badge только у «Друзей»", async () => {
    const { container, render } = mounted();
    await render(
      <TabBar label="Разделы">
        <NavItem label="Вишлист" icon={<Heart />} selected href="/" />
        <NavItem label="Поиск" icon={<Search />} selected={false} href="/search" />
        <NavItem label="Друзья" icon={<Users />} badge={2} selected={false} href="/friends" />
        <NavItem label="Брони" icon={<CalendarCheck />} selected={false} href="/reservations" />
        <NavItem label="Профиль" icon={<User />} selected={false} href="/profile" />
      </TabBar>,
    );

    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/search",
      "/friends",
      "/reservations",
      "/profile",
    ]);
    expect(links.map((link) => link.textContent)).toEqual([
      "Вишлист",
      "Поиск",
      "2Друзья",
      "Брони",
      "Профиль",
    ]);
    expect(container.querySelectorAll("a[aria-current='page']")).toHaveLength(1);
    // One count pill, hidden from the reader: the icon glyphs are aria-hidden too.
    const pills = Array.from(container.querySelectorAll("[aria-hidden='true']")).filter(
      (node) => node.textContent === "2",
    );
    expect(pills).toHaveLength(1);
  });

  it("Badge тоже доступен отдельно: 0 не рисуется", async () => {
    const { container, render } = mounted();
    await render(
      <TabBar label="Разделы">
        <NavItem label="Друзья" icon={<Users />} badge={0} selected={false} href="/friends" />
        <Badge count={0} />
      </TabBar>,
    );

    expect(container.textContent).toBe("Друзья");
  });

  it("displayName совпадает с именем компонента", () => {
    expect(TabBar.displayName).toBe("TabBar");
  });
});

describe("TabBar (native twin)", () => {
  it("safe area снизу только на телефоне: высота 56 плюс inset", () => {
    expect(tabBarNativeSource).toContain("useSafeAreaInsets");
    expect(tabBarNativeSource).toContain("paddingBottom={insets.bottom}");
    expect(tabBarNativeSource).toContain('spacing["tab-bar"] + insets.bottom');
  });
});
