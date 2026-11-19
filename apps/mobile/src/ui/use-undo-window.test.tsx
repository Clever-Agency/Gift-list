// @vitest-environment happy-dom
import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUndoWindow } from "@/ui/use-undo-window";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const START = new Date("2026-11-19T10:00:00.000Z");

let root: Root;
let container: HTMLDivElement;
let commits = 0;

function Probe({ undoUntil }: { undoUntil: string | null }) {
  const undo = useUndoWindow(undoUntil);
  useEffect(function countCommit() {
    commits += 1;
  });
  return (
    <span
      data-testid="window"
      data-open={String(undo.open)}
      data-minutes={String(undo.minutes)}
      data-remaining={String(undo.remainingMs)}
    />
  );
}

Probe.displayName = "Probe";

function window(): { open: boolean; minutes: number; remainingMs: number } {
  const node = container.querySelector<HTMLElement>('[data-testid="window"]');
  expect(node, "проба окна отмены").not.toBeNull();
  const data = (node as HTMLElement).dataset;
  return {
    open: data.open === "true",
    minutes: Number(data.minutes),
    remainingMs: Number(data.remaining),
  };
}

function at(offsetMs: number): string {
  return new Date(START.getTime() + offsetMs).toISOString();
}

async function mount(node: ReactNode) {
  await act(async () => {
    root.render(node);
  });
  // The hook refreshes the clock in a 0-ms timer: no wait for the 30-second tick.
  act(() => {
    vi.advanceTimersByTime(0);
  });
}

async function rerender(node: ReactNode) {
  await act(async () => {
    root.render(node);
  });
  act(() => {
    vi.advanceTimersByTime(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.setSystemTime(START);
  commits = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

/**
 * Story 5.3 (D-43, ARCH-A5): клиент не знает про десять минут — он отсчитывает
 * остаток от серверного `undoUntil`, показывает целые минуты вверх и сам
 * перестаёт тикать, когда окно закрылось.
 */
describe("useUndoWindow", () => {
  it("окно на десять минут вперёд: открыто, показывает 10 мин", async () => {
    await mount(<Probe undoUntil={at(10 * 60_000)} />);

    expect(window()).toEqual({ open: true, minutes: 10, remainingMs: 10 * 60_000 });
    // Один интервал — и ничего сверх него.
    expect(vi.getTimerCount()).toBe(1);
  });

  it("округляет минуты вверх, как подпись «ещё {minutes} мин»", async () => {
    await mount(<Probe undoUntil={at(61_000)} />);
    expect(window().minutes).toBe(2);

    await rerender(<Probe undoUntil={at(2 * 60_000 - 1)} />);
    expect(window().minutes).toBe(2);
  });

  it("тикает раз в 30 с и показывает остаток целыми минутами", async () => {
    await mount(<Probe undoUntil={at(10 * 60_000)} />);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(window().minutes).toBe(10);
    expect(window().remainingMs).toBe(9 * 60_000 + 30_000);

    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(window().minutes).toBe(8);

    act(() => {
      vi.advanceTimersByTime(7 * 60_000);
    });
    expect(window().minutes).toBe(1);
  });

  it("перестаёт тикать, когда окно закрылось", async () => {
    await mount(<Probe undoUntil={at(60_000)} />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(window()).toEqual({ open: false, minutes: 0, remainingMs: 0 });
    expect(vi.getTimerCount()).toBe(0);

    const settled = commits;
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(commits).toBe(settled);
    expect(window().open).toBe(false);
  });

  it("момент в прошлом — окно закрыто и тикать нечему", async () => {
    await mount(<Probe undoUntil={at(-1)} />);

    expect(window()).toEqual({ open: false, minutes: 0, remainingMs: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("null, пустая строка и мусор — закрытое окно без таймеров", async () => {
    await mount(<Probe undoUntil={null} />);
    expect(window().open).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    await rerender(<Probe undoUntil="" />);
    expect(window().open).toBe(false);

    await rerender(<Probe undoUntil="не дата" />);
    expect(window().open).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("новая карточка после долгой паузы считается от текущего времени", async () => {
    await mount(<Probe undoUntil={null} />);

    // Гипотеза: экран открыт час назад, карточку закрыли только сейчас.
    act(() => {
      vi.advanceTimersByTime(60 * 60_000);
    });
    await rerender(<Probe undoUntil={new Date(START.getTime() + 60 * 60_000 + 10 * 60_000).toISOString()} />);

    expect(window()).toEqual({ open: true, minutes: 10, remainingMs: 10 * 60_000 });
  });

  it("смена момента перезапускает отсчёт, не дожидаясь 30 с", async () => {
    await mount(<Probe undoUntil={at(3 * 60_000)} />);
    expect(window().minutes).toBe(3);

    await rerender(<Probe undoUntil={at(8 * 60_000)} />);
    expect(window()).toEqual({ open: true, minutes: 8, remainingMs: 8 * 60_000 });
  });
});
