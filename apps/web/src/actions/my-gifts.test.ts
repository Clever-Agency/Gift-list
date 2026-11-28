import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  findUnique,
  findMany,
  count,
  ensureOwnerList,
  findFriendship,
  findBlock,
  findSubscription,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(async () => 0),
  ensureOwnerList: vi.fn(),
  // Story 4.1.1: the relation reader now asks the friendship and block tables.
  findFriendship: vi.fn(async () => null),
  findBlock: vi.fn(async () => null),
  // Story 4.6: the relation reader also reads the directed Subscription edge.
  findSubscription: vi.fn(async () => null),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    list: { findUnique },
    gift: { findMany, count },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
    friendship: { findUnique: findFriendship },
    block: { findFirst: findBlock },
    subscription: { findUnique: findSubscription },
  },
}));
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
  closedAt: Date | null;
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
    closedAt: null,
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

type GiftWhere = {
  listId?: string;
  archivedAt?: null;
  NOT?: { archivedAt: null };
};

function isArchivedQuery(where: GiftWhere): boolean {
  return where.NOT?.archivedAt === null;
}

/** Owner reads query twice: active rows, then archived. Honour both filters. */
function seedGifts(rows: Row[]) {
  findMany.mockImplementation(function filterRows({ where }: { where: GiftWhere }) {
    return Promise.resolve(
      rows.filter(function matchArchive(row) {
        return (row.archivedAt !== null) === isArchivedQuery(where);
      }),
    );
  });
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  ensureOwnerList.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1", ownerId: "u1", publicToken: "tok-1" });
  seedGifts([]);
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
      data: { access: "gifts", gifts: [], archived: [], archivedTotal: 0, publicToken: "tok-new" },
    });
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledTimes(2);
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
    seedGifts([
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

  /**
   * D-49: the owner sees a reserved wish as open — no holder, no owner action,
   * not even the status of the reservation.
   */
  it("maps a reserved owner card to the AD-12 contract as an open wish", async () => {
    seedGifts([
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
      status: "OPEN",
      reservedBy: null,
      reservationLabel: null,
      ownerAction: null,
      undoUntil: null,
    });
    expect(JSON.stringify(card)).not.toContain("Анна");
    expect(JSON.stringify(card)).not.toContain("anna");
  });

  /**
   * D-49: no phase and no toggle brings the holder or an owner action back.
   */
  it.each(["ACTIVE", "AWAITING_GIVER", "AWAITING_OWNER", "GIVEN"] as const)(
    "hides the holder and the owner action in the %s phase",
    async (phase) => {
      seedGifts([
        gift({
          status: "RESERVED",
          reservationPhase: phase,
          holderVisibleToOwner: true,
          reservedBy: { id: "u2", nick: "anna", name: "Анна" },
        }),
      ]);

      const [card] = giftsOf(await getMyGifts(headers));
      expect(card?.status).toBe("OPEN");
      expect(card?.reservedBy).toBeNull();
      expect(card?.ownerAction).toBeNull();
      expect(card?.reservationLabel).toBeNull();
    },
  );

  it("offers no owner action and no holder on an open gift", async () => {
    seedGifts([gift({ id: "g1", status: "OPEN" })]);

    const [card] = giftsOf(await getMyGifts(headers));
    expect(card?.ownerAction).toBeNull();
    expect(card?.reservedBy).toBeNull();
  });

  /** D-49: a closed wish keeps its status, but its past holder stays hidden. */
  it("hides the past holder of a closed wish with the toggle on", async () => {
    seedGifts([
      gift({
        status: "CLOSED",
        reservationPhase: "GIVEN",
        holderVisibleToOwner: true,
        reservedBy: { id: "u2", nick: "anna", name: "Анна" },
      }),
    ]);

    const [card] = giftsOf(await getMyGifts(headers));
    expect(card?.status).toBe("CLOSED");
    expect(card?.reservedBy).toBeNull();
    expect(card?.ownerAction).toBeNull();
  });

  it("gives the owner archived wishes separately from the active list", async () => {
    seedGifts([
      gift({ id: "g1", title: "Активное" }),
      gift({
        id: "g-arch",
        title: "Архивное",
        archivedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ]);

    const result = await getMyGifts(headers);
    expect(giftsOf(result).map((card) => card.id)).toEqual(["g1"]);
    expect(result).toMatchObject({
      ok: true,
      data: {
        archived: [expect.objectContaining({ id: "g-arch", title: "Архивное" })],
      },
    });
  });

  it("still hides the holder on a closed gift when the toggle is off", async () => {
    seedGifts([
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
