import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTHOR_MAILTO, getMessages } from "@gift-list/contracts";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";

const { headers, buildWishMetadata, getBrandName } = vi.hoisted(() => ({
  headers: vi.fn(),
  buildWishMetadata: vi.fn(),
  getBrandName: vi.fn(() => "WishMoon"),
}));

vi.mock("next/headers", () => ({ headers }));
vi.mock("@/lib/env", () => ({ getBrandName }));
vi.mock("./wish-page", () => ({ buildWishMetadata }));

import WishNotFound, { generateMetadata } from "./not-found";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

async function render(): Promise<string> {
  const element = await WishNotFound();
  return renderToString(<GiftListProvider config={config}>{element}</GiftListProvider>);
}

beforeEach(() => {
  headers.mockReset();
  buildWishMetadata.mockReset();
  headers.mockResolvedValue(new Headers({ "accept-language": "ru-RU,ru;q=0.9" }));
  buildWishMetadata.mockReturnValue({
    title: "Желание не найдено — WishMoon",
    description: "Сервис вишлистов",
  });
});

describe("app/l/[token]/[giftId]/not-found.tsx", () => {
  it("renders the one «Желание не найдено.» sentence and the public footer", async () => {
    const messages = getMessages("ru");
    const html = await render();

    expect(messages.web.wishlist.wishNotFound).toBe("Желание не найдено.");
    expect(html.match(/aria-level="1"/g) ?? []).toHaveLength(1);
    expect(html).toContain("Желание не найдено.");
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать автору");
    expect(html).toContain('role="contentinfo"');
    // No wish and no list leaks into the 404.
    expect(html).not.toContain("Список не найден.");
    expect(html).not.toContain("Куплю сам");
  });

  it("gives the 404 document its own closed head from the wish metadata builder", async () => {
    const metadata = await generateMetadata();

    expect(buildWishMetadata).toHaveBeenCalledWith(
      { locale: "ru", view: { kind: "not_found" } },
      "WishMoon",
    );
    expect(metadata.title).toBe("Желание не найдено — WishMoon");
  });

  it("negotiates the boundary locale from Accept-Language like the page", async () => {
    headers.mockResolvedValue(new Headers({ "accept-language": "en-US,en;q=0.9" }));

    await generateMetadata();

    expect(buildWishMetadata).toHaveBeenCalledWith(
      { locale: "ru", view: { kind: "not_found" } },
      "WishMoon",
    );
  });
});
