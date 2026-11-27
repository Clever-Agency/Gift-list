// CLE-143 (Story 10.1, AD-22): the `/admin` collections page. Anonymous and
// USER get Next's own 404; ADMIN sees the table, its caption and the empty state.
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";

const { notFound, requireAdmin, listCollections, getBrandName } = vi.hoisted(() => ({
  notFound: vi.fn(),
  requireAdmin: vi.fn(),
  listCollections: vi.fn(),
  getBrandName: vi.fn(() => "WishMoon"),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/admin", () => ({ requireAdmin }));
vi.mock("@/lib/editorial-store", () => ({
  listEditorialCollectionsForAdmin: listCollections,
}));
vi.mock("@/lib/env", () => ({ getBrandName }));
vi.mock("@/actions/editorial-admin", () => ({
  loadCollectionAction: vi.fn(),
  createCollectionAction: vi.fn(),
  updateCollectionAction: vi.fn(),
  deleteCollectionAction: vi.fn(),
  publishCollectionAction: vi.fn(),
  unpublishCollectionAction: vi.fn(),
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
  deleteItemAction: vi.fn(),
  reorderItemsAction: vi.fn(),
}));

import AdminCollectionsPage, { generateMetadata } from "./page";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

const summary = {
  id: "c1",
  title: "Для рыбалки",
  description: null,
  coverImageUrl: null,
  itemCount: 2,
  publishedAt: null,
  updatedAt: "2026-11-27T10:00:00.000Z",
};

async function renderPage(): Promise<string> {
  const element = await AdminCollectionsPage();
  return renderToString(<GiftListProvider config={config}>{element}</GiftListProvider>);
}

beforeEach(() => {
  notFound.mockReset();
  requireAdmin.mockReset();
  listCollections.mockReset();
  listCollections.mockResolvedValue([]);
  requireAdmin.mockResolvedValue({ ok: false });
  // Next's real `notFound()` throws and stops the segment.
  notFound.mockImplementation(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("app/admin/page.tsx: the gate", () => {
  it("answers an anonymous visitor with the standard 404", async () => {
    await expect(AdminCollectionsPage()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(listCollections).not.toHaveBeenCalled();
  });

  it("answers a USER with the same 404 and reads no collections", async () => {
    requireAdmin.mockResolvedValue({ ok: false });

    await expect(AdminCollectionsPage()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(listCollections).not.toHaveBeenCalled();
  });

  it("keeps the page out of search engines", () => {
    expect(generateMetadata().robots).toEqual({ index: false, follow: false });
  });
});

describe("app/admin/page.tsx: the table", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });
  });

  it("shows the empty state and the create action", async () => {
    const html = await renderPage();

    expect(html).toContain("Подборок пока нет");
    expect(html).toContain("Создать подборку");
    expect(html).not.toContain("<table");
  });

  it("renders a semantic table with the caption, column headers and a draft row", async () => {
    listCollections.mockResolvedValue([summary]);

    const html = await renderPage();

    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain("Подборки");
    expect(html.match(/<th scope="col"/g)).toHaveLength(5);
    expect(html).toContain("Название");
    expect(html).toContain("Элементов");
    expect(html).toContain("Статус");
    expect(html).toContain("Изменена");
    expect(html).toContain("Действия");
    expect(html).toContain("Для рыбалки");
    expect(html).toContain("Черновик");
    expect(html).toContain("27.11.2026");
    expect(html).toContain("Изменить подборку «Для рыбалки»");
    expect(html).toContain("Удалить подборку «Для рыбалки»");
  });

  it("marks a published collection instead of a draft", async () => {
    listCollections.mockResolvedValue([
      { ...summary, publishedAt: "2026-11-27T09:00:00.000Z" },
    ]);

    const html = await renderPage();

    expect(html).toContain("Опубликована");
    expect(html).not.toContain("Черновик");
  });
});
