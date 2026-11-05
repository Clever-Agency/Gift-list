import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach } from "vitest";
import { createGiftListConfig } from "./config";
import { GiftListProvider } from "./provider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** One config per test file, as in an app (createTamagui registers itself globally). */
export const testConfig = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

export function withProvider(element: ReactElement): ReactElement {
  return <GiftListProvider config={testConfig}>{element}</GiftListProvider>;
}

export type Mounted = {
  container: HTMLDivElement;
  /** Renders into the provider; call again to update props. */
  render: (element: ReactElement) => Promise<void>;
};

/** Mounts into `document.body` with the provider; unmounts after each test. */
export function createMount(): () => Mounted {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    document.body.innerHTML = "";
  });

  return function mounted() {
    return {
      container: container as HTMLDivElement,
      async render(element) {
        await act(async () => {
          root?.render(withProvider(element));
        });
      },
    };
  };
}

/** Lets timers and animation frames queued by a layer run. */
export async function settle(ms = 50): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}
