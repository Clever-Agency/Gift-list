// @vitest-environment happy-dom
import { act, cloneElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NavLink } from "@/ui/nav-link";

const pressed = vi.hoisted(function createPressed() {
  return { href: [] as string[] };
});

// An honest `asChild`: the router's Link adds `href` and `onPress` to its only child
// and draws nothing of its own (a second element would give two links).
vi.mock("expo-router", () => ({
  Link: function Link({
    href,
    asChild,
    children,
  }: {
    href: string;
    asChild?: boolean;
    children: ReactElement<Record<string, unknown>>;
  }) {
    if (!asChild) return <a href={href}>{children}</a>;
    return cloneElement(children, {
      href,
      onPress: function onPress() {
        pressed.href.push(href);
      },
    });
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("NavLink", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("рисует ровно одну настоящую ссылку с href и ролью link", async () => {
    await act(async () => {
      root.render(<NavLink href="/login">Войти</NavLink>);
    });

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute("href")).toBe("/login");
    expect(anchors[0].getAttribute("role")).toBe("link");
    expect(anchors[0].textContent).toBe("Войти");
    expect(container.querySelectorAll("a a")).toHaveLength(0);
  });

  it("нажатие уходит в роутер", async () => {
    pressed.href.length = 0;
    await act(async () => {
      root.render(<NavLink href="/register">Регистрация</NavLink>);
    });

    await act(async () => {
      container.querySelector("a")?.click();
    });
    expect(pressed.href).toEqual(["/register"]);
  });
});
