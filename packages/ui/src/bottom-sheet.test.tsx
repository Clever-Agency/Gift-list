// @vitest-environment happy-dom
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { BottomSheet } from "./bottom-sheet";
import { sheetMotion } from "./motion";
import { settle, createMount } from "./test-utils";

const mounted = createMount();

/** «Уменьшить движение»: настоящий `prefers-reduced-motion` happy-dom не считает. */
const media = vi.hoisted(() => ({ reduce: false }));
vi.mock("./use-reduce", () => ({ useReduceMotion: () => media.reduce }));

function noop() {}

function scrim(): HTMLElement | null {
  return document.querySelector("[data-testid='sheet-scrim']");
}

beforeEach(() => {
  media.reduce = false;
});

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

  it("сдвиг и fade шторки — quick 160 мс", async () => {
    const { render } = mounted();
    await render(<BottomSheet open title="Кто видит" onClose={noop} testID="sheet" />);
    await settle(300);

    // Скрим виден в DOM: его fade идёт с `quick` (позицию шторки happy-dom не
    // измеряет, поэтому длительность сдвига проверяет `motion.test.ts`).
    expect(scrim()?.style.transition).toContain("160ms");
    expect(sheetMotion(false)).toBe("quick");
  });

  it("при reduce позиция без сдвига, скрим только fade до 100 мс", async () => {
    media.reduce = true;
    const { render } = mounted();
    await render(<BottomSheet open title="Кто видит" onClose={noop} testID="sheet" />);

    // Первый кадр — enter-класс Tamagui: fade идёт от прозрачности, не от сдвига.
    expect(scrim()?.className).toContain("t_unmounted");

    await settle(300);
    expect(scrim()?.style.transition).toContain("100ms");
    expect(sheetMotion(true)).toBe("instant");
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

  it("первый кадр не сообщает onClosed: фокус не прыгает в начале закрытия", async () => {
    const onClosed = vi.fn();
    const { render } = mounted();
    await render(
      <BottomSheet open title="Кто видит" onClose={noop} onClosed={onClosed} testID="sheet" />,
    );
    await settle(300);
    expect(onClosed).not.toHaveBeenCalled();

    await render(
      <BottomSheet
        open={false}
        title="Кто видит"
        onClose={noop}
        onClosed={onClosed}
        testID="sheet"
      />,
    );
    // happy-dom не доводит позицию шторки до `end`, поэтому сам колбэк здесь не
    // проверить; важно, что закрытие не возвращает фокус в первом кадре.
    expect(onClosed).not.toHaveBeenCalled();
  });
});
