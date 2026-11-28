// CLE-144 (Story 10.2, AD-22): the `/admin/tags` page. Anonymous and USER get
// Next's own 404; ADMIN sees the queue, its caption and the empty state.
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";

const { notFound, requireAdmin, listQueue, listCatalog, getBrandName } = vi.hoisted(() => ({
  notFound: vi.fn(),
  requireAdmin: vi.fn(),
  listQueue: vi.fn(),
  listCatalog: vi.fn(),
  getBrandName: vi.fn(() => "WishMoon"),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/admin", () => ({ requireAdmin }));
vi.mock("@/lib/env", () => ({ getBrandName }));
vi.mock("@/lib/custom-tag-store", () => ({
  listCustomTagQueue: listQueue,
  listTagCatalogForAdmin: listCatalog,
}));
vi.mock("@/actions/custom-tag-admin", () => ({
  approveCustomTagAction: vi.fn(),
  rejectCustomTagAction: vi.fn(),
}));

import AdminTagsPage, { generateMetadata } from "./page";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

const queueItem = {
  normalizedText: "айфон",
  sampleText: "Айфон",
  usageCount: 3,
};

const catalogTag = { id: "t1", slug: "iphone", label: "Айфон" };

async function renderPage(): Promise<string> {
  const element = await AdminTagsPage();
  return renderToString(<GiftListProvider config={config}>{element}</GiftListProvider>);
}

beforeEach(() => {
  notFound.mockReset();
  requireAdmin.mockReset();
  listQueue.mockReset();
  listCatalog.mockReset();
  listQueue.mockResolvedValue([]);
  listCatalog.mockResolvedValue([]);
  requireAdmin.mockResolvedValue({ ok: false });
  // Next's real `notFound()` throws and stops the segment.
  notFound.mockImplementation(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("app/admin/tags/page.tsx: the gate", () => {
  it("answers an anonymous visitor with the standard 404", async () => {
    await expect(AdminTagsPage()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(listQueue).not.toHaveBeenCalled();
    expect(listCatalog).not.toHaveBeenCalled();
  });

  it("answers a USER with the same 404 and reads no queue", async () => {
    requireAdmin.mockResolvedValue({ ok: false });

    await expect(AdminTagsPage()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(listQueue).not.toHaveBeenCalled();
  });

  it("keeps the page out of search engines", () => {
    expect(generateMetadata().robots).toEqual({ index: false, follow: false });
  });
});

describe("app/admin/tags/page.tsx: the queue", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });
  });

  it("shows the calm empty sentence and no table", async () => {
    const html = await renderPage();

    expect(html).toContain("Тегов на модерации нет");
    expect(html).not.toContain("<table");
  });

  it("renders a semantic table with the caption, column headers and a row", async () => {
    listQueue.mockResolvedValue([queueItem]);
    listCatalog.mockResolvedValue([catalogTag]);

    const html = await renderPage();

    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain("Свои теги на модерации");
    expect(html.match(/<th scope="col"/g)).toHaveLength(3);
    expect(html).toContain("Текст");
    expect(html).toContain("Использований");
    expect(html).toContain("Действия");
    expect(html).toContain("Айфон");
    expect(html).toContain(">3<");
    expect(html).toContain("Одобрить «Айфон»");
    expect(html).toContain("Отклонить «Айфон»");
  });

  it("shows no owner or wish data in the queue", async () => {
    listQueue.mockResolvedValue([queueItem]);

    const html = await renderPage();

    expect(html).not.toContain("giftId");
    expect(html).not.toContain("authorId");
  });
});
