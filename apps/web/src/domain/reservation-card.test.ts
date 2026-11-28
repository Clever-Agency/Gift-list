import { reservationCardSchema } from "@gift-list/contracts";
import { describe, expect, it } from "vitest";
import {
  canOpenGift,
  toReservationCard,
  type ReservationCardRow,
  type ReservationRelations,
} from "./reservation-card";

const OWNER_ID = "owner1";
const HOLDER_ID = "holder1";

const STRANGER: ReservationRelations = {
  blocked: false,
  friend: false,
  subscriber: false,
  contactMatch: false,
};
const FRIEND: ReservationRelations = { ...STRANGER, friend: true };
const SUBSCRIBER: ReservationRelations = { ...STRANGER, subscriber: true };
const BLOCKED: ReservationRelations = { ...STRANGER, blocked: true, friend: true };

/** End of the picked day, as `reservationDueAtFromDueOn` stores it. */
function endOfDayUtc(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function row(overrides: Partial<ReservationCardRow> = {}): ReservationCardRow {
  return {
    id: "g1",
    status: "RESERVED",
    title: "Наушники",
    titleSnapshotOnReserve: "Наушники",
    reservationDueAt: endOfDayUtc("2026-12-09"),
    reservationTimeZone: "UTC",
    reservationPhase: "ACTIVE",
    reservationBought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    visibility: "FRIENDS",
    archivedAt: null,
    priceAmount: 199,
    priceCurrency: "BYN",
    reservedById: HOLDER_ID,
    list: { ownerId: OWNER_ID, owner: { nick: "anna" } },
    ...overrides,
  };
}

describe("toReservationCard", () => {
  const CARD_KEYS = [
    "giftId",
    "titleSnapshot",
    "status",
    "ownerNick",
    "dueAt",
    "phase",
    "bought",
    "holderVisibleToOwner",
    "holderVisibleToOthers",
    "priceAmount",
    "priceCurrency",
    "photoUrl",
    "canOpenGift",
  ];

  it("returns the closed card the strict contract accepts", () => {
    const card = toReservationCard(row(), FRIEND);

    expect(reservationCardSchema.parse(card)).toEqual(card);
    expect(Object.keys(card).sort()).toEqual([...CARD_KEYS].sort());
    expect(card.status).toBe("RESERVED");
    expect(card.giftId).toBe("g1");
  });

  /** A-14/AD-7: no tags, description, link, owner name or visibility on the card. */
  it("carries no field outside the AD-7 card set", () => {
    const card = toReservationCard(row({ title: "Наушники Sony", visibility: "SECRET" }), STRANGER);

    for (const forbidden of [
      "title",
      "description",
      "linkUrl",
      "visibility",
      "tags",
      "reservationTimeZone",
      "ownerId",
      "ownerName",
      "listToken",
    ]) {
      expect(card).not.toHaveProperty(forbidden);
    }
  });

  it("keeps the moment-of-reserving title after the owner renamed the wish", () => {
    const card = toReservationCard(
      row({ title: "Наушники Sony WH-1000XM5", titleSnapshotOnReserve: "Наушники" }),
      FRIEND,
    );

    expect(card.titleSnapshot).toBe("Наушники");
  });

  it("uses the current owner nick, not a snapshot", () => {
    const card = toReservationCard(
      row({ list: { ownerId: OWNER_ID, owner: { nick: "anna-new" } } }),
      FRIEND,
    );

    expect(card.ownerNick).toBe("anna-new");
  });

  it("falls back to the current title when the snapshot is missing or blank", () => {
    const missing = toReservationCard(
      row({ title: "Наушники", titleSnapshotOnReserve: null }),
      FRIEND,
    );
    const blank = toReservationCard(
      row({ title: "Наушники", titleSnapshotOnReserve: "   " }),
      FRIEND,
    );

    expect(missing.titleSnapshot).toBe("Наушники");
    expect(blank.titleSnapshot).toBe("Наушники");
  });

  it("reads the picked day back in the snapshot zone", () => {
    // 2026-12-09 00:00 in Moscow is stored as 2026-12-08T21:00Z.
    const moscow = toReservationCard(
      row({
        reservationDueAt: new Date("2026-12-08T21:00:00.000Z"),
        reservationTimeZone: "Europe/Moscow",
      }),
      FRIEND,
    );
    const utc = toReservationCard(
      row({ reservationDueAt: endOfDayUtc("2026-12-09"), reservationTimeZone: null }),
      FRIEND,
    );

    expect(moscow.dueAt).toBe("2026-12-08");
    expect(utc.dueAt).toBe("2026-12-08");
  });

  it("passes the phase, the mark and the guests' toggle through, and always hides the owner flag", () => {
    const card = toReservationCard(
      row({
        reservationPhase: "AWAITING_OWNER",
        reservationBought: true,
        holderVisibleToOwner: true,
        holderVisibleToOthers: false,
      }),
      FRIEND,
    );

    expect(card).toMatchObject({
      phase: "AWAITING_OWNER",
      bought: true,
      holderVisibleToOwner: false,
      holderVisibleToOthers: false,
    });
  });

  /** AD-12 (ред. 2026-11-26): the current price of the wish, not a snapshot. */
  it("carries the current price while the detail is open", () => {
    const card = toReservationCard(
      row({ priceAmount: 250, priceCurrency: "RUB" }),
      FRIEND,
    );

    expect(card).toMatchObject({ priceAmount: 250, priceCurrency: "RUB" });
  });

  /** A-14: a closed card answers `null`/`null` even when the row has a price. */
  it("drops the price once the detail is closed", () => {
    const unfriended = toReservationCard(row(), STRANGER);
    const blocked = toReservationCard(row(), BLOCKED);

    for (const card of [unfriended, blocked]) {
      expect(card).toMatchObject({
        canOpenGift: false,
        priceAmount: null,
        priceCurrency: null,
      });
    }
  });

  it("keeps both price fields null for a wish without a price", () => {
    const card = toReservationCard(
      row({ priceAmount: null, priceCurrency: null }),
      FRIEND,
    );

    expect(card).toMatchObject({ priceAmount: null, priceCurrency: null });
  });

  /** ARCH-A18: wishes have no photos yet, so the field is always `null`. */
  it("always answers a null photo", () => {
    expect(toReservationCard(row(), FRIEND).photoUrl).toBeNull();
    expect(toReservationCard(row(), STRANGER).photoUrl).toBeNull();
  });
});

describe("canOpenGift", () => {
  it("opens a FRIENDS wish for the friend who holds it", () => {
    expect(canOpenGift(row({ visibility: "FRIENDS" }), FRIEND)).toBe(true);
  });

  /** UNFRIEND_CARD: the card stays, the detail does not. */
  it("closes a FRIENDS wish after an unfriend", () => {
    expect(canOpenGift(row({ visibility: "FRIENDS" }), STRANGER)).toBe(false);
  });

  it("opens a PUBLIC wish for a subscriber or a contact match", () => {
    expect(canOpenGift(row({ visibility: "PUBLIC" }), SUBSCRIBER)).toBe(true);
    expect(
      canOpenGift(row({ visibility: "PUBLIC" }), { ...STRANGER, contactMatch: true }),
    ).toBe(true);
  });

  /** LINK_ONLY: the list token is not part of «Мои брони», so it opens nothing. */
  it("closes a PUBLIC wish held through the list link with no relation", () => {
    expect(canOpenGift(row({ visibility: "PUBLIC" }), STRANGER)).toBe(false);
  });

  /** BLOCK_CARD: a block on either side closes the detail even for a friend. */
  it("closes the wish on a block", () => {
    expect(canOpenGift(row({ visibility: "PUBLIC" }), BLOCKED)).toBe(false);
  });

  it("never opens a SECRET or an archived wish", () => {
    expect(canOpenGift(row({ visibility: "SECRET" }), FRIEND)).toBe(false);
    expect(
      canOpenGift(
        row({
          visibility: "PUBLIC",
          archivedAt: new Date("2026-11-01T00:00:00.000Z"),
        }),
        FRIEND,
      ),
    ).toBe(false);
  });

  it("closes the detail of a reservation that is no longer live", () => {
    expect(canOpenGift(row({ status: "CLOSED" }), FRIEND)).toBe(false);
    expect(canOpenGift(row({ status: "OPEN" }), FRIEND)).toBe(false);
  });
});
