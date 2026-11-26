// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Bell, Users } from "./icons";
import { NavItem } from "./nav-item";
import navItemNativeSource from "./nav-item.native.tsx?raw";
import { colors, spacing } from "./tokens";
import { createMount, declarationsFor, stateValues } from "./test-utils";

const mounted = createMount();

describe("NavItem (tab, web)", () => {
  it("настоящая ссылка: адрес, подпись с числом и без aria-current у неактивной", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem
        label="Друзья"
        secondary="Друзья, 2 запроса"
        icon={<Users />}
        badge={2}
        selected={false}
        href="/friends"
        testID="friends"
      />,
    );

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute("href")).toBe("/friends");
    expect(anchors[0].getAttribute("aria-current")).toBeNull();
    expect(anchors[0].getAttribute("aria-label")).toBe("Друзья, 2 запроса");
    expect(anchors[0].textContent).toContain("Друзья");
    expect(anchors[0].textContent).toContain("2");
    expect(container.querySelector("svg")).not.toBeNull();

    // The badge is decorative; the item's own name carries the number.
    const badge = container.querySelector<HTMLElement>("[data-testid='friends-badge']");
    expect(badge?.getAttribute("aria-hidden")).toBe("true");
  });

  it("активная вкладка: aria-current, полоса 3 px primary и высота 56", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem label="Вишлист" icon={<Users />} selected href="/" testID="wishlist" />,
    );

    const item = container.querySelector<HTMLElement>("[data-testid='wishlist']") as HTMLElement;
    expect(item.getAttribute("aria-current")).toBe("page");
    // The token is the 56 px of `{spacing.tab-bar}`; Tamagui writes it as a CSS variable.
    expect(declarationsFor(item, "min-height").map((one) => one.value)).toContain(
      "var(--t-size-tab-bar)",
    );
    expect(spacing["tab-bar"]).toBe(56);
    expect(declarationsFor(item, "border-top-width").map((one) => one.value)).toContain("3px");
    expect(declarationsFor(item, "border-color").map((one) => one.value)).toContain(
      "var(--primary)",
    );
  });

  it("иконка Bell берёт цвет активной вкладки — primary, как другие иконки", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem label="Уведомления" icon={<Bell testID="bell" />} selected href="/notifications" />,
    );

    const icon = container.querySelector<SVGElement>("[data-testid='bell']");
    expect(icon?.getAttribute("stroke")).toBe(colors.primary);
  });

  it("иконка Bell у невыбранной вкладки — muted-foreground, а не цвет ссылки", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem
        label="Уведомления"
        icon={<Bell testID="bell" />}
        selected={false}
        href="/notifications"
      />,
    );

    const icon = container.querySelector<SVGElement>("[data-testid='bell']");
    expect(icon?.getAttribute("stroke")).toBe(colors["muted-foreground"]);
  });

  it("ссылка не отдаёт браузерные цвета :link/:visited/:active — color: inherit", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem label="Поиск" icon={<Users />} selected={false} href="/search" testID="search" />,
    );

    const item = container.querySelector<HTMLElement>("[data-testid='search']") as HTMLElement;
    expect(declarationsFor(item, "color").map((one) => one.value)).toContain("inherit");
  });

  it("неактивная вкладка: полоса прозрачная, без aria-current", async () => {
    const { container, render } = mounted();
    await render(<NavItem label="Поиск" icon={<Users />} selected={false} href="/search" testID="search" />);

    const item = container.querySelector<HTMLElement>("[data-testid='search']") as HTMLElement;
    expect(item.getAttribute("aria-current")).toBeNull();
    expect(declarationsFor(item, "border-top-width").map((one) => one.value)).toContain("3px");
    // The resting strip is transparent: no `primary` rule at all.
    expect(declarationsFor(item, "border-color").map((one) => one.value)).not.toContain(
      "var(--primary)",
    );
  });

  it("isFocused от TabTrigger asChild считается активностью", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem label="Брони" icon={<Users />} selected={false} isFocused href="/reservations" testID="res" />,
    );

    expect(container.querySelector("[data-testid='res']")?.getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("badge 0 не рисуется и не попадает в имя", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem label="Друзья" icon={<Users />} badge={0} selected={false} href="/friends" testID="friends" />,
    );

    expect(container.querySelectorAll("[data-testid='friends-badge']")).toHaveLength(0);
    expect(container.querySelector("a")?.getAttribute("aria-label")).toBeNull();
  });

  it("переход делает сама ссылка: press зовёт onPress", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <NavItem label="Профиль" icon={<Users />} selected={false} href="/profile" onPress={onPress} />,
    );

    const anchor = container.querySelector("a") as HTMLAnchorElement;
    await act(async () => {
      anchor.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("NavItem (side, web)", () => {
  it("строка: высота 44, полоса слева и фон muted у активной", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem
        variant="side"
        label="Мои брони"
        icon={<Users />}
        selected
        href="/reservations"
        testID="reservations"
      />,
    );

    const item = container.querySelector<HTMLElement>("[data-testid='reservations']") as HTMLElement;
    expect(item.getAttribute("aria-current")).toBe("page");
    expect(item.textContent).toContain("Мои брони");
    expect(declarationsFor(item, "min-height").map((one) => one.value)).toContain(
      "var(--t-size-touch-target)",
    );
    expect(spacing["touch-target"]).toBe(44);
    expect(declarationsFor(item, "border-left-width").map((one) => one.value)).toContain("3px");
    expect(declarationsFor(item, "background-color").map((one) => one.value)).toContain(
      "var(--muted)",
    );
  });

  it("иконка Bell у строки без выбора получает foreground пункта", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem
        variant="side"
        label="Уведомления"
        icon={<Bell testID="bell" />}
        selected={false}
        href="/notifications"
      />,
    );

    const icon = container.querySelector<SVGElement>("[data-testid='bell']");
    expect(icon?.getAttribute("stroke")).toBe(colors.foreground);
  });

  it("длинная кириллица не ломает строку: текст и ссылка на месте", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem
        variant="side"
        label="Мои бронирования и подарки"
        icon={<Users />}
        selected={false}
        href="/reservations"
      />,
    );

    expect(container.textContent).toContain("Мои бронирования и подарки");
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("displayName совпадает с именем компонента", () => {
    expect(NavItem.displayName).toBe("NavItem");
  });
});

/**
 * CLE-129: the side item used to fill the page `$background` on hover, which is
 * invisible on the page. It now fills `$muted`; the change rides the `quick`
 * preset on the web.
 */
describe("NavItem (side, web): hover", () => {
  it("невыбранная строка заливается muted на hover, переход 160 мс", async () => {
    const { container, render } = mounted();
    await render(
      <NavItem variant="side" label="Мои брони" icon={<Users />} selected={false} href="/reservations" testID="res" />,
    );
    const item = container.querySelector<HTMLElement>("[data-testid='res']") as HTMLElement;

    expect(stateValues(item, "hover", "background-color")).toEqual(["var(--muted)"]);
    expect(item.style.transition).toContain("160ms");
  });
});

/**
 * The phone twin cannot be mounted here (`react-native` does not parse in
 * happy-dom), so its source is read as text — the same approach as
 * `component-names.test.tsx`.
 */
describe("NavItem (native twin)", () => {
  it("вкладка — Pressable с role=tab, selected и подписью, в которую входит badge", () => {
    expect(navItemNativeSource).toContain('role={tab ? "tab" : "link"}');
    expect(navItemNativeSource).toContain("accessibilityState={tab ? { selected: active } : undefined}");
    expect(navItemNativeSource).toContain("accessibilityLabel={accessibleName}");
    expect(navItemNativeSource).toContain("<Pressable");
    // The badge count must be in the name, as on the web.
    expect(navItemNativeSource).toContain("badge !== undefined && badge > 0 ? `${label}, ${badge}`");
  });
});
