import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTHOR_MAILTO, getMessages } from "@gift-list/contracts";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";

const { headers } = vi.hoisted(() => ({ headers: vi.fn() }));

vi.mock("next/headers", () => ({ headers }));

import InviteNotFound from "./not-found";

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
  headers.mockResolvedValue(new Headers({ "accept-language": "ru-RU,ru;q=0.9" }));
});

describe("app/i/[token]/not-found.tsx", () => {
  it("renders the catalog sentence and the full public footer for every hidden cause", async () => {
    const messages = getMessages("ru");
    const html = await render();

    expect(messages.web.invite.notFound).toBe("Приглашение не найдено.");
    expect(html.match(/aria-level="1"/g)?.length).toBe(1);
    expect(html).toContain("Приглашение не найдено.");
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать автору");
    expect(html).toContain("Сделано с любовью командой cleverAgency");
    expect(html).toContain('role="contentinfo"');
    // No inviter, action or wishlist copy reaches the 404.
    expect(html).not.toContain("Принять приглашение");
    expect(html).not.toContain("У меня уже есть аккаунт");
    expect(html).not.toContain("Пока нет открытых желаний");
    expect(html).not.toContain("Список не найден.");
  });
});
