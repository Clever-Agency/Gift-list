// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it } from "vitest";
import { InfoButton } from "./info-button.native";
import { createMount, settle } from "./test-utils";

const mounted = createMount();

const copy = {
  label: "Что видно по ссылке",
  explanation:
    "По ссылке видны только открытые для всех желания. Приватные желания не показываются.",
  closeLabel: "Закрыть",
};

/**
 * The native file cannot use Tamagui Tooltip: on native it renders only its
 * Trigger. This DOM test mounts the native variant to prove the fallback is a
 * visible Dialog with the same text; it is not a device or screen-reader run.
 */
describe("InfoButton: нативная замена Tooltip", () => {
  it("нажатие открывает видимый диалог с тем же пояснением", async () => {
    const { container, render } = mounted();
    await render(<InfoButton {...copy} testID="info" />);

    const trigger = container.querySelector('[data-testid="info"]') as HTMLElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute("aria-label")).toBe(copy.label);
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");

    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();

    const dialog = document.querySelector("[role='dialog']") as HTMLElement;
    expect(dialog).not.toBeNull();
    const description = document.getElementById(
      dialog.getAttribute("aria-describedby") as string,
    );
    expect(description?.textContent).toBe(copy.explanation);
    expect(document.body.textContent).toContain(copy.explanation);
    expect(document.querySelector("button[aria-label='Закрыть']")).not.toBeNull();
  });

  it("крестик/кнопка закрытия убирает пояснение и возвращает фокус", async () => {
    const { container, render } = mounted();
    await render(<InfoButton {...copy} testID="info" />);

    const trigger = container.querySelector('[data-testid="info"]') as HTMLElement;
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();

    const close = document.querySelector("button[aria-label='Закрыть']") as HTMLElement;
    await act(async () => {
      close.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle();

    expect(document.querySelector("[role='dialog']")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
