import type { ReactNode } from "react";
import { vi } from "vitest";

/**
 * Every mobile test renders through `react-dom/client`, and every `@gift-list/ui`
 * component needs the theme provider above it. Instead of wrapping each `root.render`
 * call by hand, this setup mounts the real `GiftListProvider` around whatever a test
 * renders: the tests keep asserting behaviour, not the library's DOM.
 *
 * The config is created once per test file (`createTamagui` registers itself globally),
 * the same way the app creates it once per bundle in `app/_layout.tsx`.
 */
vi.mock("react-dom/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom/client")>();
  const { GiftListProvider, createGiftListConfig } = await import("@gift-list/ui");
  const config = createGiftListConfig({ body: "var(--font-sans)", heading: "var(--font-heading)" });

  function createRoot(...args: Parameters<typeof actual.createRoot>) {
    const root = actual.createRoot(...args);
    return {
      render(node: ReactNode) {
        root.render(<GiftListProvider config={config}>{node}</GiftListProvider>);
      },
      unmount() {
        root.unmount();
      },
    };
  }

  return { ...actual, createRoot };
});
