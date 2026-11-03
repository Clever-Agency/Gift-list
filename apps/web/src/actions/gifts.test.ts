import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, create } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { list: { findUnique }, gift: { create } } }));

import { giftCardSchema } from "@gift-list/contracts";

import { createGift } from "./gifts";

const headers = new Headers();

type Row = {
  id: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: "USD" | "EUR" | "CNY" | "BYN" | "RUB" | null;
  linkUrl: string | null;
  visibility: "PUBLIC" | "FRIENDS" | "SECRET";
  quantity: "SINGLE" | "UNLIMITED";
  expiresOn: Date | null;
  archivedAt: Date | null;
  status: "OPEN" | "RESERVED" | "CLOSED";
  reservationPhase: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  holderVisibleToOwner: boolean;
  reservedBy: { id: string; nick: string; name: string } | null;
};

function createdRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "g1",
    title: "Книга",
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    status: "OPEN",
    reservationPhase: null,
    holderVisibleToOwner: false,
    reservedBy: null,
    ...overrides,
  };
}

function createdData(result: Awaited<ReturnType<typeof createGift>>) {
  if (!result.ok) throw new Error(`unexpected error: ${result.code}`);
  return result.data;
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  create.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1" });
  create.mockResolvedValue(createdRow());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createGift", () => {
  it("requires a session", async () => {
    getSession.mockResolvedValue(null);

    expect(await createGift(headers, { title: "Книга" })).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a body without a title", async () => {
    expect(await createGift(headers, {})).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "title",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an unknown currency", async () => {
    expect(
      await createGift(headers, { title: "Книга", priceAmount: 100, priceCurrency: "GBP" }),
    ).toMatchObject({ ok: false, code: "VALIDATION", field: "priceCurrency" });
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["not a link", "ftp://example.com/item", "javascript:alert(1)"])(
    "rejects the link %s",
    async (linkUrl) => {
      expect(await createGift(headers, { title: "Книга", linkUrl })).toMatchObject({
        ok: false,
        code: "VALIDATION",
        field: "linkUrl",
      });
      expect(create).not.toHaveBeenCalled();
    },
  );

  /** AD-6/AD-8/AD-25/ARCH-A17: the defaults live in the contract, not the use-case. */
  it("creates a minimal wish with the contract defaults", async () => {
    await createGift(headers, { title: "Книга" });

    expect(create).toHaveBeenCalledWith({
      data: {
        listId: "l1",
        title: "Книга",
        description: null,
        priceAmount: null,
        priceCurrency: null,
        linkUrl: null,
        visibility: "PUBLIC",
        status: "OPEN",
      },
      select: expect.any(Object),
    });
  });

  it("stores USD when an amount comes without a currency", async () => {
    await createGift(headers, { title: "Книга", priceAmount: 1250 });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceAmount: 1250, priceCurrency: "USD" }),
      }),
    );
  });

  /** AD-6: the list belongs to the session user; the body cannot choose it. */
  it("looks the list up by the session user id", async () => {
    getSession.mockResolvedValue({ user: { id: "u2" }, session: { token: "t" } });
    findUnique.mockResolvedValue({ id: "l2" });
    create.mockResolvedValue(createdRow());

    await createGift(headers, { title: "Книга" });

    expect(findUnique).toHaveBeenCalledWith({
      where: { ownerId: "u2" },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ listId: "l2" }) }),
    );
  });

  it("rejects listId and ownerId in the body instead of honouring them", async () => {
    expect(
      await createGift(headers, { title: "Книга", listId: "l9", ownerId: "u9" }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND when the session user has no list", async () => {
    findUnique.mockResolvedValue(null);

    expect(await createGift(headers, { title: "Книга" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns an owner card matching the AD-12 contract", async () => {
    create.mockResolvedValue(createdRow({ id: "g7", title: "Наушники" }));

    const result = await createGift(headers, { title: "Наушники" });
    const card = createdData(result);

    expect(giftCardSchema.safeParse(card).success).toBe(true);
    expect(card).toMatchObject({
      id: "g7",
      title: "Наушники",
      status: "OPEN",
      visibility: "PUBLIC",
      reservedBy: null,
      ownerAction: null,
    });
  });
});
