// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Pressable } from "./pressable";
import { LinkText } from "./text";
import { createMount, declarationsFor, stateOf } from "./test-utils";

const mounted = createMount();

/**
 * W12.9: the same ring reaches `Pressable` and everything that stands on it
 * (`Choice`, `TagChip`, `WishCard`) plus `Button` and the `LinkText` of `NavLink`.
 * happy-dom paints no state, so the check reads the CSS Tamagui generated: the
 * ring must be a `:focus-visible` rule and there must be no `:focus` one — a mouse
 * click focuses a surface too, and a ring after every click is what DESIGN.md
 * forbids. A real Tab press in a browser is not exercised here.
 */
const RING = ["outline-color:var(--c-ring)", "outline-style:solid", "outline-width:2px"];

/** The `outline*` declarations `element` carries in `state`, as `property:value`. */
function outline(element: Element, state: string): string[] {
  return declarationsFor(element)
    .filter((one) => one.property.startsWith("outline") && stateOf(one) === state)
    .map((one) => `${one.property}:${one.value}`)
    .sort();
}

function expectRingOnlyOnKeyboardFocus(element: Element) {
  expect(outline(element, "focus-visible")).toEqual([...RING].sort());
  expect(outline(element, "focus")).toEqual([]);
  // The 2 px gap between the ring and the box comes from `outlineOffset`; the box
  // itself does not grow, so nothing on the page moves.
  expect(declarationsFor(element, "outline-offset").map((one) => one.value)).toEqual(["2px"]);
}

const anchorProps = { href: "/login", render: "a", role: "link" } as const;

describe("focus-ring (web): кольцо рисуется по :focus-visible", () => {
  it("Pressable — поверхность карточек, чипов и радио", async () => {
    const { container, render } = mounted();
    await render(<Pressable role="button" aria-label="Ещё" onPress={vi.fn()} />);
    expectRingOnlyOnKeyboardFocus(container.querySelector("[role='button']") as HTMLElement);
  });

  it("Button — настоящая кнопка", async () => {
    const { container, render } = mounted();
    await render(<Button label="Сохранить" onPress={vi.fn()} />);
    expectRingOnlyOnKeyboardFocus(container.querySelector("button") as HTMLElement);
  });

  it("LinkText — текстовая ссылка NavLink", async () => {
    const { container, render } = mounted();
    await render(<LinkText {...anchorProps}>Войти</LinkText>);
    expectRingOnlyOnKeyboardFocus(container.querySelector("a") as HTMLElement);
  });

  it("на всём документе нет outline-правила на голом :focus", async () => {
    const { container, render } = mounted();
    await render(
      <>
        <Pressable role="button" aria-label="Ещё" onPress={vi.fn()} />
        <Button label="Сохранить" onPress={vi.fn()} />
        <LinkText {...anchorProps}>Войти</LinkText>
      </>,
    );
    expect(container.querySelectorAll("button, a, [role='button']").length).toBe(3);
    for (const element of Array.from(container.querySelectorAll("button, a, [role='button']"))) {
      expect(outline(element, "focus")).toEqual([]);
    }
  });
});
