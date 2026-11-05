import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import UiCheckPage from "./page";
import { UiCheck } from "./ui-check";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(function notFound() {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const config = createGiftListConfig({ body: "var(--font-sans)", heading: "var(--font-heading)" });

describe("/ui-check", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("HTML первого ответа содержит карточки, кнопки и CSS Tamagui", () => {
    const html = renderToString(
      <GiftListProvider config={config}>
        <UiCheck />
      </GiftListProvider>,
    );
    expect(html).toContain("Плед");
    expect(html).toContain("Книга");
    expect(html).toContain("Открыть Dialog");
    expect(html).toContain("<style");
    expect(config.getNewCSS()).toContain("--c-primary");
    expect(config.getCSS()).toContain("var(--c-");
  });

  it("в production страница отдаёт 404", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => UiCheckPage()).toThrow("NEXT_NOT_FOUND");
  });

  it("вне production страница рендерит проверку", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(UiCheckPage()).toBeTruthy();
  });
});
