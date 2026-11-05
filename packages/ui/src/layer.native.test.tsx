// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type BackListener = () => boolean | null | undefined;

const backHandler = vi.hoisted(function createBackHandler() {
  const listeners: Array<() => boolean | null | undefined> = [];
  return {
    listeners,
    remove: vi.fn(),
    addEventListener: vi.fn(function add(_event: string, listener: () => boolean | null | undefined) {
      listeners.push(listener);
      return {
        remove: function remove() {
          const at = listeners.indexOf(listener);
          if (at !== -1) listeners.splice(at, 1);
          backHandler.remove();
        },
      };
    }),
  };
});

vi.mock("react-native", () => ({ BackHandler: backHandler }));

import { useBackClose } from "./layer.native";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackClose(open, onClose);
  return null;
}
Probe.displayName = "Probe";

/** What Android does on the system «назад»: the last registered listener answers first. */
function pressSystemBack(): boolean {
  for (let i = backHandler.listeners.length - 1; i >= 0; i -= 1) {
    const listener: BackListener = backHandler.listeners[i];
    if (listener()) return true;
  }
  return false;
}

describe("useBackClose (Android «назад»)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    backHandler.listeners.length = 0;
    backHandler.remove.mockClear();
    backHandler.addEventListener.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(open: boolean, onClose: () => void) {
    await act(async () => {
      root.render(<Probe open={open} onClose={onClose} />);
    });
  }

  it("открытый слой: «назад» закрывает слой и возвращает true", async () => {
    const onClose = vi.fn();
    await render(true, onClose);

    expect(backHandler.addEventListener).toHaveBeenCalledWith("hardwareBackPress", expect.any(Function));
    expect(pressSystemBack()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("закрытый слой «назад» не перехватывает", async () => {
    const onClose = vi.fn();
    await render(false, onClose);

    expect(backHandler.listeners).toHaveLength(0);
    expect(pressSystemBack()).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("слой закрылся: подписка снята, «назад» снова работает как раньше", async () => {
    const onClose = vi.fn();
    await render(true, onClose);
    await render(false, onClose);

    expect(backHandler.listeners).toHaveLength(0);
    expect(pressSystemBack()).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("после размонтирования подписки нет", async () => {
    const onClose = vi.fn();
    await render(true, onClose);
    expect(backHandler.listeners).toHaveLength(1);

    await act(async () => root.unmount());
    expect(backHandler.listeners).toHaveLength(0);
    expect(backHandler.remove).toHaveBeenCalledTimes(1);
    expect(pressSystemBack()).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    // afterEach unmounts again: re-create a root so the teardown stays valid.
    root = createRoot(container);
  });

  it("берёт свежий onClose без переподписки", async () => {
    const first = vi.fn();
    const second = vi.fn();
    await render(true, first);
    await render(true, second);

    expect(backHandler.addEventListener).toHaveBeenCalledTimes(1);
    pressSystemBack();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
