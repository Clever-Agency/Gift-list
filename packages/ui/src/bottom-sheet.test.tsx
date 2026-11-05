// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { BottomSheet } from "./bottom-sheet";
import { settle, createMount } from "./test-utils";

const mounted = createMount();

function noop() {}

describe("BottomSheet", () => {
  it("открытая шторка показывает заголовок, содержимое и действия", async () => {
    const { render } = mounted();
    await render(
      <BottomSheet
        open
        title="Кто видит «Плед»"
        onClose={noop}
        actions={<Button label="Отмена" variant="ghost" onPress={noop} />}
      >
        <span>Всем</span>
      </BottomSheet>,
    );
    await settle(300);

    expect(document.body.textContent).toContain("Кто видит «Плед»");
    expect(document.body.textContent).toContain("Всем");
    expect(document.querySelector("button[aria-label='Отмена']")).not.toBeNull();
  });

  it("закрытая шторка недоступна для чтения: нет открытого диалога", async () => {
    const { render } = mounted();
    await render(<BottomSheet open={false} title="Кто видит" onClose={noop} />);
    await settle(300);

    expect(document.querySelector("[role='dialog'][data-state='open']")).toBeNull();
  });

  it("Esc просит закрыть шторку", async () => {
    const onClose = vi.fn();
    const { render } = mounted();
    await render(<BottomSheet open title="Кто видит" onClose={onClose} />);
    await settle(300);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
