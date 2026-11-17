import { PRODUCT_NAME } from "@gift-list/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, headers, findUnique, create, transaction } = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: { inviteLink: { findUnique, create }, $transaction: transaction },
}));

import { buildInviteMetadata, loadInvitePage } from "./invite-page";

beforeEach(() => {
  getSession.mockReset();
  headers.mockReset();
  findUnique.mockReset();
  create.mockReset();
  transaction.mockReset();

  headers.mockResolvedValue(new Headers({ "accept-language": "ru-RU,ru;q=0.9" }));
  getSession.mockResolvedValue(null);
  findUnique.mockResolvedValue({
    user: { id: "u1", name: "Сергей", nick: "sergey" },
  });
});

describe("loadInvitePage: session and redirect", () => {
  it("redirects a real session to the one-segment app path built from the token", async () => {
    getSession.mockResolvedValue({ user: { id: "u2" } });

    const page = await loadInvitePage("tok-1");

    expect(page.view).toEqual({ kind: "redirect", to: "/invite/tok-1" });
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(["..", "%2e%2e", "a/b", "//evil.example", "https://evil.example", "tok?next=//evil.example"])(
    "treats a malformed segment %s as not found even with a session",
    async function malformed(token) {
      getSession.mockResolvedValue({ user: { id: "u2" } });

      const page = await loadInvitePage(token);

      expect(page.view).toEqual({ kind: "not_found" });
      expect(getSession).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it("does not redirect for an unrecognised cookie: no session, anonymous preview", async () => {
    getSession.mockResolvedValue(null);

    const page = await loadInvitePage("tok-1");

    expect(page.view.kind).toBe("invite");
  });
});

describe("loadInvitePage: anonymous read", () => {
  it("renders the inviter's public name and the app target", async () => {
    const page = await loadInvitePage("tok-1");

    expect(page.locale).toBe("ru");
    expect(page.view).toEqual({
      kind: "invite",
      inviter: { displayName: "Сергей", nick: "sergey" },
      to: "/invite/tok-1",
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { token: "tok-1" },
      select: { user: { select: { id: true, name: true, nick: true } } },
    });
  });

  it("answers an unknown token with the closed not-found view", async () => {
    findUnique.mockResolvedValueOnce(null);

    const page = await loadInvitePage("tok-1");

    expect(page.view).toEqual({ kind: "not_found" });
  });

  it("writes nothing: a page load opens no transaction and creates no token", async () => {
    await loadInvitePage("tok-1");
    await loadInvitePage("no-such-token");

    expect(create).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("buildInviteMetadata", () => {
  it("names only the inviter and the product for a live invite", async () => {
    const page = await loadInvitePage("tok-1");
    const metadata = buildInviteMetadata(page, PRODUCT_NAME);
    const serialized = JSON.stringify(metadata);

    expect(metadata.title).toBe(`Сергей приглашает в друзья — ${PRODUCT_NAME}`);
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.twitter).toEqual({
      card: "summary",
      title: metadata.title,
      description: metadata.description,
    });
    expect(serialized).not.toContain("tok-1");
    expect(serialized).not.toContain("sergey");
  });

  it("gives an unknown token and a session redirect one not-found metadata", async () => {
    const notFound = buildInviteMetadata({ locale: "ru", view: { kind: "not_found" } }, PRODUCT_NAME);
    const redirect = buildInviteMetadata(
      { locale: "ru", view: { kind: "redirect", to: "/invite/tok-1" } },
      PRODUCT_NAME,
    );

    expect(notFound).toEqual(redirect);
    expect(notFound.title).toBe(`Приглашение не найдено — ${PRODUCT_NAME}`);
    expect(JSON.stringify(notFound)).not.toContain("Сергей");
    expect(JSON.stringify(notFound)).not.toContain("tok-1");
  });
});
