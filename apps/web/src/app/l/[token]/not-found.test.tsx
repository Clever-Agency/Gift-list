import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTHOR_MAILTO } from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";

const { headers, buildLinkMetadata, getBrandName } = vi.hoisted(() => ({
  headers: vi.fn(),
  buildLinkMetadata: vi.fn(),
  getBrandName: vi.fn(() => "WishMoon"),
}));

vi.mock("next/headers", () => ({ headers }));
vi.mock("@/lib/env", () => ({ getBrandName }));
vi.mock("./link-page", () => ({ buildLinkMetadata }));

import WishlistNotFound, { generateMetadata } from "./not-found";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

async function render(): Promise<string> {
  const element = await WishlistNotFound();
  return renderToString(<GiftListProvider config={config}>{element}</GiftListProvider>);
}

beforeEach(() => {
  headers.mockReset();
  buildLinkMetadata.mockReset();
  headers.mockResolvedValue(new Headers({ "accept-language": "ru-RU,ru;q=0.9" }));
  buildLinkMetadata.mockReturnValue({
    title: "Список не найден — WishMoon",
    description: "Сервис вишлистов",
  });
});

describe("app/l/[token]/not-found.tsx", () => {
  it("renders the catalog sentence and the full public footer for every hidden cause", async () => {
    const messages = getWebMessages("ru");
    const html = await render();

    expect(messages.web.wishlist.notFound).toBe("Список не найден.");
    expect(html.match(/aria-level="1"/g)?.length).toBe(1);
    expect(html).toContain("Список не найден.");
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать в техподдержку");
    expect(html).toContain("Сделано с любовью командой cleverAgency");
    expect(html).toContain('role="contentinfo"');
    // Nothing of a found list or of an invite page reaches the 404.
    expect(html).not.toContain("Пока нет открытых желаний");
    expect(html).not.toContain("Приглашение не найдено.");
  });

  it("gives the 404 document its own head from the closed not-found metadata", async () => {
    const metadata = await generateMetadata();

    // Next builds the 404 document's <head> from this boundary, not from the
    // page, so the closed not-found metadata has to be produced here as well.
    expect(buildLinkMetadata).toHaveBeenCalledTimes(1);
    expect(buildLinkMetadata).toHaveBeenCalledWith({ locale: "ru", view: { kind: "not_found" } }, "WishMoon");
    expect(metadata.title).toBe("Список не найден — WishMoon");
  });

  it("negotiates the boundary locale from Accept-Language like the page", async () => {
    headers.mockResolvedValue(new Headers({ "accept-language": "en-US,en;q=0.9" }));

    await generateMetadata();

    // `ru` is the only published catalog today, so an unsupported language
    // falls back to it exactly as the page's own loader does.
    expect(buildLinkMetadata).toHaveBeenCalledWith(
      { locale: "ru", view: { kind: "not_found" } },
      "WishMoon",
    );
  });
});
