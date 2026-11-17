import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, redirect, getLinkPage, buildLinkMetadata, getBrandName } = vi.hoisted(() => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
  getLinkPage: vi.fn(),
  buildLinkMetadata: vi.fn(),
  getBrandName: vi.fn(() => "WishMoon"),
}));

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/lib/env", () => ({ getBrandName }));
vi.mock("./link-page", () => ({ getLinkPage, buildLinkMetadata }));

import PublicWishlistPage from "./page";

const params = Promise.resolve({ token: "tok-1" });
const searchParams = Promise.resolve({});

beforeEach(() => {
  notFound.mockReset();
  redirect.mockReset();
  getLinkPage.mockReset();
  buildLinkMetadata.mockReset();
  // Next's real `notFound()` throws and stops the segment; the tests do the same.
  notFound.mockImplementation(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("app/l/[token]/page.tsx", () => {
  it("calls notFound() for a closed gate instead of rendering a 200 page", async () => {
    getLinkPage.mockResolvedValue({ locale: "ru", view: { kind: "not_found" } });

    await expect(PublicWishlistPage({ params, searchParams })).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("still redirects a session into the app before any gate view is rendered", async () => {
    getLinkPage.mockResolvedValue({ locale: "ru", view: { kind: "redirect", to: "/wishlist/tok-1" } });

    await PublicWishlistPage({ params, searchParams });

    expect(redirect).toHaveBeenCalledWith("/wishlist/tok-1");
    expect(notFound).not.toHaveBeenCalled();
  });
});
