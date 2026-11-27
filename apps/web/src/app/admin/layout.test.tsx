// CLE-143 (Story 10.1, AD-22): the `/admin` shell. The gate runs in the layout,
// so a USER cannot reach any admin screen; an ADMIN gets the side menu with the
// two sections and the only link to the not-yet-built `/admin/tags`.
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGiftListConfig, GiftListProvider, Text } from "@gift-list/ui";

const { notFound, usePathname, requireAdmin, getBrandName } = vi.hoisted(() => ({
  notFound: vi.fn(),
  usePathname: vi.fn(() => "/admin"),
  requireAdmin: vi.fn(),
  getBrandName: vi.fn(() => "WishMoon"),
}));

vi.mock("next/navigation", () => ({ notFound, usePathname }));
vi.mock("@/lib/admin", () => ({ requireAdmin }));
vi.mock("@/lib/env", () => ({ getBrandName }));

import AdminLayout, { generateMetadata } from "./layout";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

async function renderLayout(): Promise<string> {
  const element = await AdminLayout({ children: <Text>Содержимое</Text> });
  return renderToString(<GiftListProvider config={config}>{element}</GiftListProvider>);
}

beforeEach(() => {
  notFound.mockReset();
  requireAdmin.mockReset();
  usePathname.mockReturnValue("/admin");
  requireAdmin.mockResolvedValue({ ok: false });
  notFound.mockImplementation(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("app/admin/layout.tsx", () => {
  it("hides the whole section from anonymous and USER", async () => {
    await expect(renderLayout()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders the side menu and the content for an ADMIN", async () => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });

    const html = await renderLayout();

    expect(html).toContain("WishMoon");
    expect(html).toContain("Разделы админки");
    expect(html).toContain("Подборки");
    expect(html).toContain("Теги");
    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/admin/tags"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Перейти к содержимому");
    expect(html).toContain('id="admin-main"');
    expect(html).toContain("Содержимое");
  });

  it("marks «Теги» as the current section on /admin/tags", async () => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });
    usePathname.mockReturnValue("/admin/tags");

    const html = await renderLayout();
    const tagsLink = html.slice(html.indexOf('href="/admin/tags"'));

    expect(tagsLink.slice(0, 200)).toContain('aria-current="page"');
  });

  it("keeps the admin shell out of search engines", () => {
    expect(generateMetadata().robots).toEqual({ index: false, follow: false });
  });
});
