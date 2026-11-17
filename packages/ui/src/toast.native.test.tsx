// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

/**
 * W12.22 (W12.9-1): the toast's buttons asked for `focus-visible:$ring-inverse`,
 * which React Native never turns on. Vitest resolves `./focus-ring` to the web
 * module, so the mock swaps in the `.native` variant before the components load
 * (as `focus-ring.native.test.tsx` does): the toast then gets the `$ring-inverse`
 * colour on `focus`, and none of its declarations waits for `:focus-visible`.
 *
 * happy-dom emits CSS classes instead of React Native inline styles, so this
 * checks the wiring, not a phone with an external keyboard.
 */
vi.mock("./focus-ring", async () => await import("./focus-ring.native"));
vi.mock("./use-reduce", () => ({ useReduceMotion: () => false }));

import { Toast } from "./toast";
import { createMount, declarationsFor, stateOf } from "./test-utils";

const mounted = createMount();

function outline(element: Element, state: string): string[] {
  return declarationsFor(element)
    .filter((one) => one.property.startsWith("outline") && stateOf(one) === state)
    .map((one) => `${one.property}:${one.value}`)
    .sort();
}

function closeButton(container: HTMLElement): Element {
  const found = container.querySelector('[aria-label="Закрыть"]');
  expect(found, "кнопка закрытия").not.toBeNull();
  return found as Element;
}

describe("Toast (native): inverse-кольцо по focus", () => {
  it("кнопка закрытия — $ring-inverse на focus, без :focus-visible", async () => {
    const { container, render } = mounted();
    await render(<Toast message="Сохранено" closeLabel="Закрыть" onClose={vi.fn()} />);

    const button = closeButton(container);

    expect(outline(button, "focus")).toEqual(
      ["outline-color:var(--c-ring-inverse)", "outline-style:solid", "outline-width:2px"].sort(),
    );
    expect(outline(button, "focus-visible")).toEqual([]);
    expect(declarationsFor(button, "outline-offset").map((one) => one.value)).toEqual(["2px"]);
  });
});
