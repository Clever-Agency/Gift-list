// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { GiftListProvider } from "./provider";
import { StatusPill } from "./status-pill";
import { testConfig } from "./test-utils";
import { VisibilityChip } from "./visibility-chip";
import { WishCard } from "./wish-card";

function page() {
  return (
    <GiftListProvider config={testConfig}>
      <WishCard
        title="Плед"
        price="2 500 ₽"
        status={<StatusPill status="open" label="Свободно" />}
        chip={<VisibilityChip tone="public" label="Всем" />}
      />
      <Button label="Забронировать" variant="reserve" onPress={() => {}} />
    </GiftListProvider>
  );
}

describe("SSR на сервере Next (без DOM)", () => {
  it("HTML первого ответа содержит разметку и CSS Tamagui", () => {
    const html = renderToString(page());

    expect(html).toContain("Плед");
    expect(html).toContain("<button");
    expect(html).toContain("<style");
    // Токены темы приходят CSS-переменными, а не инлайном в каждом узле.
    expect(html).toContain("--c-primary:#2F5D3A");
    expect(html).toContain("--c-accent:#D4A017");
    expect(html).toContain("--t-size-control-height:48px");
    // Шрифты Next приходят CSS-переменными из next/font.
    expect(html).toContain("--f-family:var(--font-sans)");
    expect(html).toContain("--f-family:var(--font-heading)");
  });

  it("атомарные классы кнопки и карточки попадают в getCSS()", () => {
    renderToString(page());
    const css = testConfig.getCSS();

    expect(css).toContain("min-height:var(--t-size-control-height)");
    expect(css).toContain("background-color:var(--c-accent)");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("border-radius:var(--t-radius-lg)");
  });
});
