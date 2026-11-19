// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

/**
 * W12.22 (W12.9-1): the toast's buttons asked for `focus-visible:$ring-inverse`,
 * which React Native never turns on. Vitest resolves `./focus-ring` to the web
 * module, so the mock swaps in the `.native` variant before the components load
 * (as `focus-ring.native.test.tsx` does): the toast then gets the `$ring` colour on
 * `focus`, and none of its declarations waits for `:focus-visible`.
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

describe("Toast (native): кольцо по focus", () => {
  it("кнопка закрытия — $ring на focus, без :focus-visible", async () => {
    const { container, render } = mounted();
    await render(<Toast message="Сохранено" closeLabel="Закрыть" onClose={vi.fn()} />);

    const button = closeButton(container);

    expect(outline(button, "focus")).toEqual(
      ["outline-color:var(--ring)", "outline-style:solid", "outline-width:2px"].sort(),
    );
    expect(outline(button, "focus-visible")).toEqual([]);
    expect(declarationsFor(button, "outline-offset").map((one) => one.value)).toEqual(["2px"]);
  });

  it("кнопка действия отдаётся по actionRef и тоже держит $ring на focus", async () => {
    const actionRef = { current: null as object | null };
    const { container, render } = mounted();
    await render(
      <Toast
        message="Отмечено полученным"
        action={{ label: "Отменить", onPress: vi.fn() }}
        actionRef={actionRef}
        closeLabel="Закрыть"
        onClose={vi.fn()}
      />,
    );

    const action = container.querySelector('[aria-label="Отменить"]');
    expect(action, "кнопка действия").not.toBeNull();
    expect(actionRef.current).toBe(action);
    expect(outline(action as Element, "focus")).toEqual(
      ["outline-color:var(--ring)", "outline-style:solid", "outline-width:2px"].sort(),
    );
    expect(outline(action as Element, "focus-visible")).toEqual([]);
  });
});
