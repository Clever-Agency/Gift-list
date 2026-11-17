import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, redirect, getInvitePage, buildInviteMetadata, getBrandName } = vi.hoisted(
  () => ({
    notFound: vi.fn(),
    redirect: vi.fn(),
    getInvitePage: vi.fn(),
    buildInviteMetadata: vi.fn(),
    getBrandName: vi.fn(() => "WishMoon"),
  }),
);

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/lib/env", () => ({ getBrandName }));
vi.mock("./invite-page", () => ({ getInvitePage, buildInviteMetadata }));

import InvitePreviewPage from "./page";

const params = Promise.resolve({ token: "tok-1" });
const searchParams = Promise.resolve({});

beforeEach(() => {
  notFound.mockReset();
  redirect.mockReset();
  getInvitePage.mockReset();
  buildInviteMetadata.mockReset();
  // Next's real `notFound()` throws and stops the segment; the tests do the same.
  notFound.mockImplementation(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("app/i/[token]/page.tsx", () => {
  it("calls notFound() for a closed gate instead of rendering a 200 page", async () => {
    getInvitePage.mockResolvedValue({ locale: "ru", view: { kind: "not_found" } });

    await expect(InvitePreviewPage({ params, searchParams })).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("still redirects a signed-in visitor into the app invite screen", async () => {
    getInvitePage.mockResolvedValue({ locale: "ru", view: { kind: "redirect", to: "/invite/tok-1" } });

    await InvitePreviewPage({ params, searchParams });

    expect(redirect).toHaveBeenCalledWith("/invite/tok-1");
    expect(notFound).not.toHaveBeenCalled();
  });
});
