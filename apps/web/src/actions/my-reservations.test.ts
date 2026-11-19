import { reservationCardSchema, reservationListSchema } from "@gift-list/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findMany, relationsBetween } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findMany: vi.fn(),
  relationsBetween: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { gift: { findMany } } }));
vi.mock("@/lib/relationships", () => ({ relationshipReader: { relationsBetween } }));

import { getMyReservations } from "./my-reservations";

const HOLDER = "holder";
const OWNER = "owner";
const headers = new Headers();

const STRANGER = {
  blocked: false,
  friend: false,
  subscriber: false,
  contactMatch: false,
} as const;
const FRIEND = { ...STRANGER, friend: true } as const;
const BLOCKED = { ...STRANGER, blocked: true, friend: true } as const;

type Row = {
  id: string;
  status: "OPEN" | "RESERVED" | "CLOSED";
  title: string;
  titleSnapshotOnReserve: string | null;
  reservationDueAt: Date | null;
  reservationTimeZone: string | null;
  reservationPhase: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  reservationBought: boolean;
  holderVisibleToOwner: boolean;
  holderVisibleToOthers: boolean;
  visibility: "PUBLIC" | "FRIENDS" | "SECRET";
  archivedAt: Date | null;
  reservedById: string | null;
  list: { ownerId: string; owner: { nick: string } };
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "g1",
    status: "RESERVED",
    title: "Наушники",
    titleSnapshotOnReserve: "Наушники",
    // End of the picked day: 2026-12-10 00:00 UTC is the day 2026-12-09.
    reservationDueAt: new Date("2026-12-10T00:00:00.000Z"),
    reservationTimeZone: "UTC",
    reservationPhase: "ACTIVE",
    reservationBought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    visibility: "FRIENDS",
    archivedAt: null,
    reservedById: HOLDER,
    list: { ownerId: OWNER, owner: { nick: "anna" } },
    ...overrides,
  };
}

function reservationsOf(result: Awaited<ReturnType<typeof getMyReservations>>) {
  if (!result.ok) throw new Error(`unexpected error: ${result.code}`);
  return result.data.reservations;
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: HOLDER }, session: { token: "t" } });
  findMany.mockResolvedValue([]);
  relationsBetween.mockResolvedValue(STRANGER);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getMyReservations", () => {
  it("requires a session and reads nothing without one", async () => {
    getSession.mockResolvedValue(null);

    const result = await getMyReservations(headers);

    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(findMany).not.toHaveBeenCalled();
    expect(relationsBetween).not.toHaveBeenCalled();
  });

  /**
   * A-14: the query is scoped by the holder and the live status only. No list
   * id, visibility filter or owner input can widen it, and the selected columns
   * carry neither `publicToken` nor any price, tag or owner name.
   */
  it("reads only the caller's RESERVED rows, earliest due date first", async () => {
    await getMyReservations(headers);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: "RESERVED",
        reservedById: HOLDER,
        reservationDueAt: { not: null },
        reservationPhase: { not: null },
      },
      orderBy: [{ reservationDueAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        status: true,
        title: true,
        titleSnapshotOnReserve: true,
        reservationDueAt: true,
        reservationTimeZone: true,
        reservationPhase: true,
        reservationBought: true,
        holderVisibleToOwner: true,
        holderVisibleToOthers: true,
        visibility: true,
        archivedAt: true,
        reservedById: true,
        list: { select: { ownerId: true, owner: { select: { nick: true } } } },
      },
    });
  });

  it("answers an empty list without asking for relations", async () => {
    const result = await getMyReservations(headers);

    expect(result).toEqual({ ok: true, data: { reservations: [] } });
    expect(relationsBetween).not.toHaveBeenCalled();
  });

  it("maps a live reservation to the closed card", async () => {
    findMany.mockResolvedValue([row()]);
    relationsBetween.mockResolvedValue(FRIEND);

    const result = await getMyReservations(headers);
    const cards = reservationsOf(result);

    expect(reservationListSchema.parse({ reservations: cards })).toEqual({
      reservations: cards,
    });
    expect(cards).toEqual([
      {
        giftId: "g1",
        titleSnapshot: "Наушники",
        status: "RESERVED",
        ownerNick: "anna",
        dueAt: "2026-12-09",
        phase: "ACTIVE",
        bought: false,
        holderVisibleToOwner: false,
        holderVisibleToOthers: true,
        canOpenGift: true,
      },
    ]);
  });

  it("keeps the title snapshot and the current owner nick", async () => {
    findMany.mockResolvedValue([
      row({
        title: "Наушники Sony WH-1000XM5",
        titleSnapshotOnReserve: "Наушники",
        list: { ownerId: OWNER, owner: { nick: "anna-new" } },
      }),
    ]);
    relationsBetween.mockResolvedValue(FRIEND);

    const [card] = reservationsOf(await getMyReservations(headers));

    expect(card?.titleSnapshot).toBe("Наушники");
    expect(card?.ownerNick).toBe("anna-new");
  });

  it("reads the picked day back in the snapshot zone", async () => {
    findMany.mockResolvedValue([
      row({
        // The end of 2026-12-09 in New York is 2026-12-10 05:00 UTC.
        reservationDueAt: new Date("2026-12-10T05:00:00.000Z"),
        reservationTimeZone: "America/New_York",
      }),
    ]);
    relationsBetween.mockResolvedValue(FRIEND);

    const [card] = reservationsOf(await getMyReservations(headers));

    expect(card?.dueAt).toBe("2026-12-09");
  });

  /** UNFRIEND_CARD: the card stays, the detail link closes, every action stays. */
  it("keeps the card after an unfriend and closes only the detail", async () => {
    findMany.mockResolvedValue([
      row({ reservationPhase: "AWAITING_OWNER", reservationBought: true }),
    ]);

    const [card] = reservationsOf(await getMyReservations(headers));

    expect(card).toMatchObject({
      giftId: "g1",
      phase: "AWAITING_OWNER",
      bought: true,
      canOpenGift: false,
    });
    expect(relationsBetween).toHaveBeenCalledWith(HOLDER, OWNER);
  });

  /** BLOCK_CARD: a block closes the detail and never removes the card. */
  it("keeps the card on a block in either direction", async () => {
    findMany.mockResolvedValue([row({ visibility: "PUBLIC" })]);
    relationsBetween.mockResolvedValue(BLOCKED);

    const [card] = reservationsOf(await getMyReservations(headers));

    expect(card).toMatchObject({ giftId: "g1", canOpenGift: false });
  });

  /** LINK_ONLY: «Мои брони» carries no list token, so it opens nothing. */
  it("keeps a link-only reservation with no detail link", async () => {
    findMany.mockResolvedValue([row({ visibility: "PUBLIC" })]);

    const [card] = reservationsOf(await getMyReservations(headers));

    expect(card).toMatchObject({
      giftId: "g1",
      status: "RESERVED",
      canOpenGift: false,
    });
  });

  it("asks for relations once per distinct owner", async () => {
    findMany.mockResolvedValue([
      row({ id: "g1" }),
      row({
        id: "g2",
        list: { ownerId: "owner2", owner: { nick: "boris" } },
      }),
      row({
        id: "g3",
        reservationDueAt: new Date("2026-12-11T00:00:00.000Z"),
      }),
    ]);

    const cards = reservationsOf(await getMyReservations(headers));

    expect(cards.map((card) => card.giftId)).toEqual(["g1", "g2", "g3"]);
    expect(relationsBetween).toHaveBeenCalledTimes(2);
    expect(relationsBetween).toHaveBeenCalledWith(HOLDER, OWNER);
    expect(relationsBetween).toHaveBeenCalledWith(HOLDER, "owner2");
  });

  it("skips an incomplete reservation with the id only", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findMany.mockResolvedValue([
      row({ id: "g1" }),
      row({ id: "g-broken", reservationPhase: null }),
      row({ id: "g-no-due", reservationDueAt: null }),
    ]);

    const cards = reservationsOf(await getMyReservations(headers));

    expect(cards.map((card) => card.giftId)).toEqual(["g1"]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("Incomplete reservation row skipped", "g-broken");
    expect(warn).toHaveBeenCalledWith("Incomplete reservation row skipped", "g-no-due");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Наушники");
  });

  it("carries no list token, visibility or other wish data", async () => {
    findMany.mockResolvedValue([row({ visibility: "PUBLIC" })]);
    relationsBetween.mockResolvedValue(FRIEND);

    const result = await getMyReservations(headers);
    const [card] = reservationsOf(result);

    expect(card).toBeDefined();
    expect(Object.keys(card ?? {}).sort()).toEqual([
      "bought",
      "canOpenGift",
      "dueAt",
      "giftId",
      "holderVisibleToOthers",
      "holderVisibleToOwner",
      "ownerNick",
      "phase",
      "status",
      "titleSnapshot",
    ]);
    expect(reservationCardSchema.safeParse(card).success).toBe(true);

    const wire = JSON.stringify(result);
    for (const forbidden of [
      "publicToken",
      "listToken",
      "visibility",
      "reservationTimeZone",
      "priceAmount",
      "priceCurrency",
      "description",
      "linkUrl",
      "ownerId",
      "ownerName",
      "reservedById",
    ]) {
      expect(wire).not.toContain(forbidden);
    }
  });
});
