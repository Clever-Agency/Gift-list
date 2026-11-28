import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AUTHOR_MAILTO } from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import { PublicNotFound } from "./public-not-found";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

function render(message: string): string {
  return renderToString(
    <GiftListProvider config={config}>
      <PublicNotFound locale="ru" message={message} />
    </GiftListProvider>,
  );
}

/** L8: the 404 page has exactly one level-1 heading. */
function levelOneHeadings(html: string): number {
  return html.match(/aria-level="1"/g)?.length ?? 0;
}

describe("PublicNotFound: shared page-level 404", () => {
  it("renders the catalog sentence as the only h1 and the full public footer", () => {
    const messages = getWebMessages("ru");
    const html = render(messages.web.wishlist.notFound);

    expect(messages.web.wishlist.notFound).toBe("Список не найден.");
    expect(levelOneHeadings(html)).toBe(1);
    expect(html).toContain("Список не найден.");
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать в техподдержку");
    expect(html).toContain("Сделано с любовью командой cleverAgency");
    expect(html).toContain('role="contentinfo"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain('href="#main-content"');
    // Server HTML with the Tamagui CSS, not a client-only shell.
    expect(html).toContain("<style");
    expect(html).toContain("--primary");
  });

  it("shows exactly the sentence it is given and no owner, wishes or actions", () => {
    const messages = getWebMessages("ru");
    const html = render(messages.web.invite.notFound);

    expect(messages.web.invite.notFound).toBe("Приглашение не найдено.");
    expect(levelOneHeadings(html)).toBe(1);
    expect(html).toContain("Приглашение не найдено.");
    expect(html).not.toContain("Список не найден.");
    expect(html).not.toContain("Принять приглашение");
    expect(html).not.toContain("У меня уже есть аккаунт");
    expect(html).not.toContain("/register");
    expect(html).not.toContain("/login");
    expect(html).not.toContain("Пока нет открытых желаний");
  });
});
