import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AUTHOR_MAILTO, getMessages, type GiftCard } from "@gift-list/contracts";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import { InvitePreviewView } from "@/app/i/[token]/invite-preview-view";
import { PublicWishlistView } from "@/app/l/[token]/public-wishlist-view";
import { PublicNotFound } from "./public-not-found";
import { PublicPageFooter } from "./public-page-footer";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

function page(node: ReactNode): string {
  return renderToString(<GiftListProvider config={config}>{node}</GiftListProvider>);
}

/**
 * The exact footer element of a page: from the `div` that carries
 * `role="contentinfo"` to its matching closing tag. Tamagui renders stacks as
 * `div`, so counting `div` depth gives the real boundary. Inline `<style>` blocks
 * are dropped: they are the CSS registry of the whole render, not footer markup.
 */
function footerOf(html: string): string {
  const marker = html.indexOf('role="contentinfo"');
  expect(marker).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf("<div", marker);
  let depth = 0;
  let cursor = start;
  while (cursor < html.length) {
    const open = html.indexOf("<div", cursor);
    const close = html.indexOf("</div>", cursor);
    if (close === -1) break;
    if (open !== -1 && open < close) {
      depth += 1;
      cursor = open + 4;
      continue;
    }
    depth -= 1;
    cursor = close + 6;
    if (depth === 0) {
      return html.slice(start, cursor).replace(/<style[^>]*>.*?<\/style>/g, "");
    }
  }
  throw new Error("The footer element is not closed in the page HTML");
}

const invite = {
  kind: "invite",
  inviter: { displayName: "Сергей Петров", nick: "sergey" },
  to: "/invite/tok-1",
} as const;

const owner = { displayName: "Анна", nick: "anna" };

function card(): GiftCard {
  return {
    id: "g-open",
    title: "Плед",
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
  };
}

describe("PublicPageFooter", () => {
  it("renders the footer landmark, the author mailto link and the agency tagline", () => {
    const html = footerOf(page(<PublicPageFooter locale="ru" />));
    const messages = getMessages("ru");

    expect(html).toContain('role="contentinfo"');
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain(messages.common.writeToAuthor);
    expect(html).toContain(messages.common.footerTagline);
    // One real link, not a button or a client-only control.
    expect(html.match(/<a /g)?.length).toBe(1);
  });

  it("is the same full footer on /i and /l in every page state, including both 404 pages", () => {
    const messages = getMessages("ru");
    const pages = [
      page(<InvitePreviewView view={invite} locale="ru" brand="WishMoon" />),
      page(<PublicWishlistView view={{ kind: "gifts", owner, gifts: [card()] }} locale="ru" wishlistPath="/wishlist/tok-1" />),
      page(<PublicWishlistView view={{ kind: "gifts", owner, gifts: [] }} locale="ru" wishlistPath="/wishlist/tok-1" />),
      page(<PublicNotFound locale="ru" message={messages.web.invite.notFound} />),
      page(<PublicNotFound locale="ru" message={messages.web.wishlist.notFound} />),
    ];

    const footers = pages.map(footerOf);

    for (const footer of footers) expect(footer).toBe(footers[0]);
    for (const html of pages) {
      expect(html.match(/role="contentinfo"/g)?.length).toBe(1);
    }
    // The shared version is the full `/i` one, not the tagline-only `/l` one.
    expect(footers[0]).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(footers[0]).toContain("Написать автору");
    expect(footers[0]).toContain("Сделано с любовью командой cleverAgency");
  });
});
