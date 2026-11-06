import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, findMany, ensureOwnerList } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  ensureOwnerList: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { list: { findUnique }, gift: { findMany } } }));
vi.mock("@/lib/owner-list", () => ({ ensureOwnerList }));

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
  tags: { tagId: string | null; customText: string | null; tag: { slug: string; labels: unknown } | null }[];
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
    tags: [],
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
  ensureOwnerList.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1", ownerId: "u1", publicToken: "tok-1" });
  findMany.mockResolvedValue([]);
  ensureOwnerList.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getMyGifts", () => {
  it("requires a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await getMyGifts(headers)).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
    expect(ensureOwnerList).not.toHaveBeenCalled();
  });

  it("reads the caller's own list and only the active gifts of it", async () => {
    await getMyGifts(headers);
    expect(findUnique).toHaveBeenCalledWith({
      where: { ownerId: "u1" },
      select: {
        id: true,
        ownerId: true,
        publicToken: true,
        owner: { select: { name: true, nick: true } },
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { listId: "l1", archivedAt: null } }),
    );
  });

  /**
   * Story 2.4 (AD-6): the owner payload carries the immutable share token, even
   * when the list is empty: a zero-gift list is still a list with a link.
   */
  it("includes the list's publicToken in the owner payload", async () => {
    const result = await getMyGifts(headers);

    expect(result).toMatchObject({
      ok: true,
      data: { access: "gifts", publicToken: "tok-1" },
    });
    expect(ensureOwnerList).not.toHaveBeenCalled();
  });

  /**
   * AD-6: registration creates the list, so a missing row is an anomaly, not the
   * normal zero-gift state. The owner read repairs it and returns its new token
   * instead of silently answering an empty wishlist without a share link.
   */
  it("repairs a missing list row and returns the new publicToken", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "l1", ownerId: "u1", publicToken: "tok-new" });

    const result = await getMyGifts(headers);

    expect(ensureOwnerList).toHaveBeenCalledTimes(1);
    expect(ensureOwnerList).toHaveBeenCalledWith("u1");
    expect(warn).toHaveBeenCalledWith("Missing List row repaired for owner", "u1");
    expect(result).toEqual({
      ok: true,
      data: { access: "gifts", gifts: [], publicToken: "tok-new" },
    });
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("answers an explicit error when the missing list could not be repaired", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findUnique.mockResolvedValue(null);

    expect(await getMyGifts(headers)).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Wishlist not found",
    });
    expect(ensureOwnerList).toHaveBeenCalledWith("u1");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("orders the caller's gifts newest first with a stable tie-break", async () => {
    await getMyGifts(headers);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { listId: "l1", archivedAt: null },
        // Newest wish first; `id` keeps the order stable for equal timestamps.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
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

  /**
   * AD-7: owner visibility follows the list owner, never the session user id.
   * A row owned by somebody else is not the caller's list, so the gate answers
   * an empty wishlist and no gift of it is read at all (NFR-3).
   */
  it("answers nothing for a list row that belongs to another user", async () => {
    findUnique.mockResolvedValue({ id: "l1", ownerId: "u2" });

    const result = await getMyGifts(headers);

    expect(giftsOf(result)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(ensureOwnerList).not.toHaveBeenCalled();
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

  /**
   * AD-7: only a finished reservation asks the owner for something. While the
   * reservation is still running (holder keeps it, or the giver has not answered
   * yet), the shared holder name is shown but there is no owner action.
   */
  it.each(["ACTIVE", "AWAITING_GIVER"] as const)(
    "shows the shared holder but no owner action in the %s phase",
    async (phase) => {
      findMany.mockResolvedValue([
        gift({
          status: "RESERVED",
          reservationPhase: phase,
          holderVisibleToOwner: true,
          reservedBy: { id: "u2", nick: "anna", name: "Анна" },
        }),
      ]);

      const [card] = giftsOf(await getMyGifts(headers));
      expect(card?.ownerAction).toBeNull();
      expect(card?.reservedBy).toEqual({ id: "u2", nick: "anna", displayName: "Анна" });
    },
  );

  it("offers no owner action and no holder on an open gift", async () => {
    findMany.mockResolvedValue([gift({ id: "g1", status: "OPEN" })]);

    const [card] = giftsOf(await getMyGifts(headers));
    expect(card?.ownerAction).toBeNull();
    expect(card?.reservedBy).toBeNull();
  });

  it("keeps the holder on a closed gift when they allowed the owner to see them", async () => {
    findMany.mockResolvedValue([
      gift({
        status: "CLOSED",
        reservationPhase: "GIVEN",
        holderVisibleToOwner: true,
        reservedBy: { id: "u2", nick: "anna", name: "Анна" },
      }),
    ]);

    const [card] = giftsOf(await getMyGifts(headers));
    expect(card?.reservedBy).toEqual({ id: "u2", nick: "anna", displayName: "Анна" });
    expect(card?.ownerAction).toBeNull();
  });

  it("still hides the holder on a closed gift when the toggle is off", async () => {
    findMany.mockResolvedValue([
      gift({
        status: "CLOSED",
        reservationPhase: "GIVEN",
        holderVisibleToOwner: false,
        reservedBy: { id: "u2", nick: "anna", name: "Анна" },
      }),
    ]);

    const [card] = giftsOf(await getMyGifts(headers));
    expect(card?.reservedBy).toBeNull();
    expect(card?.ownerAction).toBeNull();
  });
});
