import { act } from "react";

/**
 * happy-dom has no layout engine: every box measures 0, so a screen that measures its
 * content area would keep the window fallback in every test. A browser supplies two
 * things happy-dom cannot — the box `getBoundingClientRect` reports and the
 * `ResizeObserver` callback that follows a size change — and this stub plays both, so
 * a test can prove what a screen does with a measurement (W12.23).
 *
 * It is not a browser layout: nothing is recomputed from CSS, the test states the
 * numbers a browser would have measured.
 */
export type SimulatedContent = {
  /** The box the browser has laid out: what the next `getBoundingClientRect` reads. */
  box(width: number): void;
  /** The observer callback the browser delivers once the content box is `width`. */
  measure(width: number): Promise<void>;
  /** Puts the real `ResizeObserver` and `getBoundingClientRect` back. */
  restore(): void;
};

/** Replaces the browser APIs the measured grid uses with test-controlled ones. */
export function observeContentWidth(): SimulatedContent {
  const ownObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  const ownRect = Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect");
  const observers: FakeResizeObserver[] = [];
  let box = 0;

  class FakeResizeObserver {
    private targets = new Set<Element>();

    constructor(private readonly callback: ResizeObserverCallback) {
      observers.push(this);
    }

    observe(target: Element): void {
      this.targets.add(target);
    }

    unobserve(target: Element): void {
      this.targets.delete(target);
    }

    disconnect(): void {
      this.targets.clear();
    }

    report(width: number): void {
      const entries = Array.from(this.targets, (target) => ({ target, contentRect: { width } }));
      if (entries.length === 0) return;
      this.callback(
        entries as unknown as ResizeObserverEntry[],
        this as unknown as ResizeObserver,
      );
    }
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: FakeResizeObserver,
  });
  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    configurable: true,
    writable: true,
    value: function reportedBox() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: box,
        bottom: 0,
        width: box,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  });

  return {
    box(width) {
      box = width;
    },

    async measure(width) {
      box = width;
      await act(async () => {
        for (const observer of observers) observer.report(width);
      });
    },

    restore() {
      if (ownObserver) Object.defineProperty(globalThis, "ResizeObserver", ownObserver);
      else Reflect.deleteProperty(globalThis, "ResizeObserver");
      if (ownRect) Object.defineProperty(Element.prototype, "getBoundingClientRect", ownRect);
      else Reflect.deleteProperty(Element.prototype, "getBoundingClientRect");
    },
  };
}
