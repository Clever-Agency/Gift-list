"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";

// Один конфиг на бандл; шрифты приходят CSS-переменными из next/font (layout.tsx).
const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

/** Провайдер Tamagui и выдача накопленного при SSR CSS в `<head>` первого ответа. */
export function TamaguiRegistry({ children }: { children: ReactNode }) {
  // `getNewCSS()` is process-global and Next flushes the stream several times per
  // response: emit one tag per request, and none while there is nothing new.
  const inserted = useRef(false);
  useServerInsertedHTML(function insertTamaguiCss() {
    if (inserted.current) return null;
    const css = config.getNewCSS();
    if (!css) return null;
    inserted.current = true;
    return <style id="tamagui-ssr" dangerouslySetInnerHTML={{ __html: css }} />;
  });

  return <GiftListProvider config={config}>{children}</GiftListProvider>;
}

TamaguiRegistry.displayName = "TamaguiRegistry";
