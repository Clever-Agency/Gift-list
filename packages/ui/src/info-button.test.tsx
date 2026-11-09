// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it } from "vitest";
import { InfoButton } from "./info-button";
import { createMount, settle } from "./test-utils";

const mounted = createMount();

const copy = {
  label: "Что видно по ссылке",
  explanation: "По ссылке видны только открытые для всех желания.",
  closeLabel: "Закрыть",
};

async function click(trigger: HTMLElement) {
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
}

/**
 * A DOM (happy-dom) test of the web Tooltip trigger, not a real browser run: it
 * proves that a tap opens the explanation once and that the second tap closes it
 * again, which touch-web cannot get from hover or focus alone.
 */
describe("InfoButton: повторный тап закрывает Tooltip", () => {
  it("первый тап открывает пояснение, второй закрывает", async () => {
    const { container, render } = mounted();
    await render(<InfoButton {...copy} testID="info" />);

    const trigger = container.querySelector('[data-testid="info"]') as HTMLElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.textContent).toContain(copy.explanation);

    await click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.textContent).not.toContain(copy.explanation);
  });
});
