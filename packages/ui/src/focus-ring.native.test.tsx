// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

/**
 * W12.9: the phone half reaches the same components. Vitest resolves `./focus-ring`
 * to the web module, so the mock swaps in the `.native` variant before the
 * components load (as `a11y-hint.native.test.tsx` does): Tamagui then compiles the
 * `focus:` values the phone gets. happy-dom emits CSS classes where React Native
 * would get inline styles, so this checks the wiring — that the `focus` state is
 * understood and keeps the `$ring` outline — not a device with a hardware keyboard.
 */
vi.mock("./focus-ring", async () => await import("./focus-ring.native"));

import { Button } from "./button";
import { Pressable } from "./pressable";
import { LinkText } from "./text";
import { createMount, declarationsFor, stateOf } from "./test-utils";

const mounted = createMount();

const RING = ["outline-color:var(--c-ring)", "outline-style:solid", "outline-width:2px"];

function outline(element: Element, state: string): string[] {
  return declarationsFor(element)
    .filter((one) => one.property.startsWith("outline") && stateOf(one) === state)
    .map((one) => `${one.property}:${one.value}`)
    .sort();
}

function expectRingOnFocus(element: Element) {
  expect(outline(element, "focus")).toEqual([...RING].sort());
  // `:focus-visible` never comes on in React Native: a ring that waited for it
  // would be invisible on a phone.
  expect(outline(element, "focus-visible")).toEqual([]);
  expect(declarationsFor(element, "outline-offset").map((one) => one.value)).toEqual(["2px"]);
}

const anchorProps = { href: "/login", render: "a", role: "link" } as const;

describe("focus-ring (native): кольцо по focus в компонентах", () => {
  it("Pressable", async () => {
    const { container, render } = mounted();
    await render(<Pressable role="button" aria-label="Ещё" onPress={vi.fn()} />);
    expectRingOnFocus(container.querySelector("[role='button']") as HTMLElement);
  });

  it("Button", async () => {
    const { container, render } = mounted();
    await render(<Button label="Сохранить" onPress={vi.fn()} />);
    expectRingOnFocus(container.querySelector("button") as HTMLElement);
  });

  it("LinkText", async () => {
    const { container, render } = mounted();
    await render(<LinkText {...anchorProps}>Войти</LinkText>);
    expectRingOnFocus(container.querySelector("a") as HTMLElement);
  });
});
