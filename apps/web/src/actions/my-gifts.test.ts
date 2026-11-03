import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, findMany } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { list: { findUnique }, gift: { findMany } } }));

import { getMyGifts } from "./my-gifts";

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

function gift(overrides: Partial<Row> = {}): Row {
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

function giftsOf(result: Awaited<ReturnType<typeof getMyGifts>>) {
  if (!result.ok) throw new Error(`unexpected error: ${result.code}`);
  return result.data.gifts;
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1" });
  findMany.mockResolvedValue([]);
});

describe("getMyGifts", () => {
  it("requires a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await getMyGifts(headers)).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("reads the caller's own list and only the active gifts of it", async () => {
    await getMyGifts(headers);
    expect(findUnique).toHaveBeenCalledWith({ where: { ownerId: "u1" }, select: { id: true } });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { listId: "l1", archivedAt: null } }),
    );
  });

  it("answers an empty wishlist when the list row is missing", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getMyGifts(headers)).toEqual({
      ok: true,
      data: { access: "gifts", gifts: [] },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns every own gift, including SECRET", async () => {
    findMany.mockResolvedValue([
      gift({ id: "g1", visibility: "SECRET" }),
      gift({ id: "g2", visibility: "FRIENDS" }),
      gift({ id: "g3", visibility: "PUBLIC" }),
    ]);

    const result = await getMyGifts(headers);
    expect(result).toMatchObject({ ok: true, data: { access: "gifts" } });
    expect(giftsOf(result).map((card) => card.visibility)).toEqual(["SECRET", "FRIENDS", "PUBLIC"]);
  });

  it("maps an owner card to the AD-12 contract", async () => {
    findMany.mockResolvedValue([
      gift({
        id: "g1",
        title: "Наушники",
        description: "Беспроводные",
        priceAmount: 19900,
        priceCurrency: "BYN",
        linkUrl: "https://shop.example/headphones",
        visibility: "FRIENDS",
        quantity: "UNLIMITED",
        expiresOn: new Date("2026-12-31T00:00:00.000Z"),
        status: "RESERVED",
        reservationPhase: "GIVEN",
        holderVisibleToOwner: true,
        reservedBy: { id: "u2", nick: "anna", name: "Анна" },
      }),
    ]);

    const [card] = giftsOf(await getMyGifts(headers));
    expect(card).toEqual({
      id: "g1",
      title: "Наушники",
      description: "Беспроводные",
      priceAmount: 19900,
      priceCurrency: "BYN",
      linkUrl: "https://shop.example/headphones",
      visibility: "FRIENDS",
      quantity: "UNLIMITED",
      expiresOn: "2026-12-31",
      archivedAt: null,
      tags: [],
      status: "RESERVED",
      reservedBy: { id: "u2", nick: "anna", displayName: "Анна" },
      reservationLabel: null,
      ownerAction: "CONFIRM_GIVEN",
    });
  });

  it("keeps the holder hidden until they allow the owner to see them", async () => {
    findMany.mockResolvedValue([
      gift({
        status: "RESERVED",
        reservationPhase: "ACTIVE",
        holderVisibleToOwner: false,
        reservedBy: { id: "u2", nick: "anna", name: "Анна" },
      }),
    ]);

    const [card] = giftsOf(await getMyGifts(headers));
    expect(card?.reservedBy).toBeNull();
    expect(card?.ownerAction).toBeNull();
  });

  it("asks the owner to answer an expired reservation", async () => {
    findMany.mockResolvedValue([
      gift({ status: "RESERVED", reservationPhase: "AWAITING_OWNER" }),
    ]);

    const [card] = giftsOf(await getMyGifts(headers));
    expect(card?.ownerAction).toBe("EXPIRED_NO_REPLY");
  });

  it("offers no owner action and no holder on an open or closed gift", async () => {
    findMany.mockResolvedValue([
      gift({ id: "g1", status: "OPEN" }),
      gift({
        id: "g2",
        status: "CLOSED",
        reservationPhase: "GIVEN",
        holderVisibleToOwner: true,
        reservedBy: { id: "u2", nick: "anna", name: "Анна" },
      }),
    ]);

    const cards = giftsOf(await getMyGifts(headers));
    expect(cards.map((card) => card.ownerAction)).toEqual([null, null]);
    expect(cards.map((card) => card.reservedBy)).toEqual([null, null]);
  });
});
