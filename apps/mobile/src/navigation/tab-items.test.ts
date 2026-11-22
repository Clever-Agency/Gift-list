// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TAB_ITEMS, TAB_TRIGGERS, sectionOf } from "./tab-items";

/**
 * The one list of the five sections (Story 6.2, UX-A13): order, addresses, icons,
 * both label keys (`app.nav`) and the single badge of «Друзья». Both navigations —
 * the bottom tabs and the side menu — read it, so the test fixes the list itself,
 * not a copy of it in one of them.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const app = JSON.parse(
  readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
) as { nav: Record<string, string> };

/** `app.nav` resolves the way `useTranslations("app.nav")` prefixes it. */
function nav(key: string): string {
  const value = app.nav[key];
  if (typeof value !== "string") throw new Error(`Нет строки app.nav.${key}`);
  return value;
}

describe("tab-items: пять разделов UX-A13", () => {
  it("порядок «Вишлист · Поиск · Друзья · Брони · Профиль», первый — /", () => {
    expect(TAB_ITEMS.map((item) => item.key)).toEqual([
      "wishlist",
      "search",
      "friends",
      "reservations",
      "profile",
    ]);
    expect(TAB_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/search",
      "/friends",
      "/reservations",
      "/profile",
    ]);
    // `backBehavior: "firstRoute"` needs the first route to be «Вишлист».
    expect(TAB_ITEMS[0]?.href).toBe("/");
  });

  it("адреса и имена триггеров не повторяются", () => {
    expect(new Set(TAB_ITEMS.map((item) => item.href)).size).toBe(TAB_ITEMS.length);
    expect(new Set(TAB_ITEMS.map((item) => item.name)).size).toBe(TAB_ITEMS.length);
  });

  it("подписи вкладок — короткие, подписи меню — полные, все из app.nav", () => {
    expect(TAB_ITEMS.map((item) => nav(item.tabLabel))).toEqual([
      "Вишлист",
      "Поиск",
      "Друзья",
      "Брони",
      "Профиль",
    ]);
    expect(TAB_ITEMS.map((item) => nav(item.menuLabel))).toEqual([
      "Мой вишлист",
      "Поиск",
      "Друзья",
      "Мои брони",
      "Профиль",
    ]);
  });

  it("badge — только у «Друзей»", () => {
    expect(TAB_ITEMS.filter((item) => item.badge).map((item) => item.key)).toEqual(["friends"]);
  });

  it("у каждого раздела своя иконка 24 px", () => {
    for (const item of TAB_ITEMS) {
      expect(typeof item.Icon).toBe("function");
    }
    expect(new Set(TAB_ITEMS.map((item) => item.Icon)).size).toBe(TAB_ITEMS.length);
  });

  it("триггеры headless Tabs повторяют список: внутренние, по порядку, первый /", () => {
    expect(TAB_TRIGGERS).toEqual([
      { type: "internal", name: "wishlist", href: "/" },
      { type: "internal", name: "search", href: "/search" },
      { type: "internal", name: "friends", href: "/friends" },
      { type: "internal", name: "reservations", href: "/reservations" },
      { type: "internal", name: "profile", href: "/profile" },
    ]);
  });

  it("раздел узнаётся только по точному корню, вложенные экраны — не раздел", () => {
    expect(sectionOf("/")?.key).toBe("wishlist");
    expect(sectionOf("/friends/")?.key).toBe("friends");
    expect(sectionOf("/settings")).toBeUndefined();
    expect(sectionOf("/gifts/new")).toBeUndefined();
    expect(sectionOf("/u/anya")).toBeUndefined();
  });
});
