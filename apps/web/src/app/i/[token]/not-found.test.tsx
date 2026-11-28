import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTHOR_MAILTO } from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";

const { headers, buildInviteMetadata, getBrandName } = vi.hoisted(() => ({
  headers: vi.fn(),
  buildInviteMetadata: vi.fn(),
  getBrandName: vi.fn(() => "WishMoon"),
}));

vi.mock("next/headers", () => ({ headers }));
vi.mock("@/lib/env", () => ({ getBrandName }));
vi.mock("./invite-page", () => ({ buildInviteMetadata }));

import InviteNotFound, { generateMetadata } from "./not-found";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

async function render(): Promise<string> {
  const element = await InviteNotFound();
  return renderToString(<GiftListProvider config={config}>{element}</GiftListProvider>);
}

beforeEach(() => {
  headers.mockReset();
  buildInviteMetadata.mockReset();
  headers.mockResolvedValue(new Headers({ "accept-language": "ru-RU,ru;q=0.9" }));
  buildInviteMetadata.mockReturnValue({
    title: "Приглашение не найдено — WishMoon",
    description: "Сервис вишлистов",
  });
});

describe("app/i/[token]/not-found.tsx", () => {
  it("renders the catalog sentence and the full public footer for every hidden cause", async () => {
    const messages = getWebMessages("ru");
    const html = await render();

    expect(messages.web.invite.notFound).toBe("Приглашение не найдено.");
    expect(html.match(/aria-level="1"/g)?.length).toBe(1);
    expect(html).toContain("Приглашение не найдено.");
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать в техподдержку");
    expect(html).toContain("Сделано с любовью командой cleverAgency");
    expect(html).toContain('role="contentinfo"');
    // No inviter, action or wishlist copy reaches the 404.
    expect(html).not.toContain("Принять приглашение");
    expect(html).not.toContain("У меня уже есть аккаунт");
    expect(html).not.toContain("Пока нет открытых желаний");
    expect(html).not.toContain("Список не найден.");
  });

  it("gives the 404 document its own head from the closed not-found metadata", async () => {
    const metadata = await generateMetadata();

    // Next builds the 404 document's <head> from this boundary, not from the
    // page, so the closed not-found metadata has to be produced here as well.
    expect(buildInviteMetadata).toHaveBeenCalledTimes(1);
    expect(buildInviteMetadata).toHaveBeenCalledWith(
      { locale: "ru", view: { kind: "not_found" } },
      "WishMoon",
    );
    expect(metadata.title).toBe("Приглашение не найдено — WishMoon");
  });

  it("negotiates the boundary locale from Accept-Language like the page", async () => {
    headers.mockResolvedValue(new Headers({ "accept-language": "en-US,en;q=0.9" }));

    await generateMetadata();

    // `ru` is the only published catalog today, so an unsupported language
    // falls back to it exactly as the page's own loader does.
    expect(buildInviteMetadata).toHaveBeenCalledWith(
      { locale: "ru", view: { kind: "not_found" } },
      "WishMoon",
    );
  });
});
