import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import { PUBLIC_MAIN_ID, PublicPageFrame } from "./public-page-frame";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

function render(header?: ReactNode): string {
  return renderToString(
    <GiftListProvider config={config}>
      <PublicPageFrame locale="ru" header={header}>
        <p>Содержимое</p>
      </PublicPageFrame>
    </GiftListProvider>,
  );
}

/** The Tamagui `<style>` block belongs to the head of the render, not to the body. */
function body(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/g, "");
}

/** The offset of the first occurrence, or -1. */
function at(html: string, needle: string): number {
  return html.indexOf(needle);
}

describe("PublicPageFrame: общий каркас /l и /i", () => {
  it("renders the skip link from the catalog as the first element of the shell", () => {
    const html = body(render());
    const skipAt = at(html, `href="#${PUBLIC_MAIN_ID}"`);

    expect(getWebMessages("ru").web.skipToContent).toBe("Перейти к содержимому");
    expect(html).toContain("Перейти к содержимому");
    expect(skipAt).toBeGreaterThan(-1);
    // First in the Tab order: no link or button is painted before the skip link.
    const beforeSkip = html.slice(0, skipAt);
    expect(beforeSkip).not.toContain("href=");
    expect(beforeSkip).not.toContain("<button");
    expect(beforeSkip).not.toContain('tabindex="0"');
    expect(skipAt).toBeLessThan(at(html, "<main"));
    expect(skipAt).toBeLessThan(at(html, "Написать в техподдержку"));
  });

  it("puts the header after the skip link and before the one main landmark", () => {
    const html = body(render(<a href="/login">Войти</a>));

    expect(at(html, `href="#${PUBLIC_MAIN_ID}"`)).toBeLessThan(at(html, 'href="/login"'));
    expect(at(html, 'href="/login"')).toBeLessThan(at(html, "<main"));
    expect(html.match(/<main/g)).toHaveLength(1);
    expect(html).toContain(`id="${PUBLIC_MAIN_ID}"`);
  });

  it("makes main the real target of the link: the id and tabindex=-1", () => {
    const html = body(render());

    expect(html).toMatch(new RegExp(`<main[^>]*id="${PUBLIC_MAIN_ID}"`));
    expect(html).toMatch(/<main[^>]*tabindex="-1"/);
  });

  it("keeps the shared footer and the Tamagui CSS of the server render", () => {
    const html = render();

    expect(html).toContain("Написать в техподдержку");
    expect(html).toContain("Сделано с любовью командой cleverAgency");
    expect(html).toContain('role="contentinfo"');
    expect(html).toContain("<style");
  });

  /**
   * CLE-135 (Story 6.4): the Tab stop of a raw `<a>` around `LinkText` is the
   * anchor itself, so the ring of `LinkText` inside never paints. The shell CSS
   * gives that anchor the same `DESIGN.md` → «Кольцо фокуса» state — `$ring`,
   * 2 px, offset 2 px, keyboard only (`:focus-visible`).
   */
  it("даёт сырой ссылке кольцо фокуса из общего стиля каркаса", () => {
    const css = readFileSync(
      new URL("./public-page-frame.module.css", import.meta.url),
      "utf8",
    );

    expect(css).toMatch(
      /\.link:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--c-ring\);[^}]*outline-offset:\s*2px;/,
    );
  });
});
