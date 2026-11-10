// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

/**
 * `@tamagui/web` captures `window.matchMedia` when it is first imported, so the
 * mock has to be installed before the imports below (hence `vi.hoisted`). This is
 * a controllable mock, not the operating system setting: the real
 * `prefers-reduced-motion` and `AccessibilityInfo.isReduceMotionEnabled` are not
 * exercised here.
 */
const windowMedia = vi.hoisted(() => {
  let reduce = false;
  const listeners = new Set<() => void>();

  function matches(query: string): boolean {
    const found = /\(\s*prefers-reduced-motion\s*:\s*(reduce|no-preference)\s*\)/i.exec(query);
    if (!found) return false;
    return (found[1] as string).toLowerCase() === "reduce" ? reduce : !reduce;
  }

  function matchMedia(query: string) {
    return {
      media: query,
      get matches() {
        return matches(query);
      },
      addListener(listener: () => void) {
        listeners.add(listener);
      },
      removeListener(listener: () => void) {
        listeners.delete(listener);
      },
      addEventListener(_: string, listener: () => void) {
        listeners.add(listener);
      },
      removeEventListener(_: string, listener: () => void) {
        listeners.delete(listener);
      },
      dispatchEvent() {
        return false;
      },
      onchange: null,
    };
  }

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    setReduceMotion(value: boolean) {
      reduce = value;
      for (const listener of [...listeners]) listener();
    },
  };
});

import { useReduceMotion } from "./use-reduce";
import { createMount } from "./test-utils";

function ReduceProbe() {
  return <span data-testid="probe">{String(useReduceMotion())}</span>;
}

ReduceProbe.displayName = "ReduceProbe";

function probeText(container: ParentNode): string | null | undefined {
  return container.querySelector('[data-testid="probe"]')?.textContent;
}

describe("useReduceMotion", () => {
  const mounted = createMount();

  it("возвращает true, когда медиазапрос совпадает", async () => {
    windowMedia.setReduceMotion(true);
    const view = mounted();
    await view.render(<ReduceProbe />);
    expect(probeText(view.container)).toBe("true");
  });

  it("возвращает false, когда медиазапрос не совпадает", async () => {
    windowMedia.setReduceMotion(false);
    const view = mounted();
    await view.render(<ReduceProbe />);
    expect(probeText(view.container)).toBe("false");
  });
});
