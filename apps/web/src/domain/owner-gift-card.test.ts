import { giftCardSchema, type SupportedLocale } from "@gift-list/contracts";
import { describe, expect, it } from "vitest";
import { toOwnerGiftCard, type OwnerGiftRow } from "./owner-gift-card";

const HOLDER = { id: "holder1", nick: "holder", name: "Holder Name" };

/** Reservation columns the owner mapper must ignore even when the row carries them. */
type ReservationNoise = {
  reservationPhase?: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  reservationBought?: boolean;
  holderVisibleToOwner?: boolean;
  reservedBy?: { id: string; nick: string; name: string } | null;
};

function row(overrides: Partial<OwnerGiftRow> & ReservationNoise = {}): OwnerGiftRow {
  return {
    id: "g1",
    title: "Наушники",
    description: null,
    priceAmount: 12900,
    priceCurrency: "USD",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    closedAt: null,
    status: "OPEN",
    tags: [],
    ...overrides,
  };
}

describe("toOwnerGiftCard", () => {
  /** Story 5.3 (ARCH-A5): the owner card carries the server-computed undo moment. */
  it("adds the ten-minute window to closedAt for a closed wish", () => {
    const closedAt = new Date("2026-11-19T12:00:00.000Z");
    const card = toOwnerGiftCard(row({ status: "CLOSED", closedAt }));

    expect(card.undoUntil).toBe("2026-11-19T12:10:00.000Z");
    expect(giftCardSchema.parse(card)).toEqual(card);
  });

  /** CARD_OWNER_CLOSED: the moment is returned even when the window has passed. */
  it("answers the moment after the window has passed", () => {
    const closedAt = new Date("2020-01-01T00:00:00.000Z");
    const card = toOwnerGiftCard(row({ status: "CLOSED", closedAt }));

    expect(card.undoUntil).toBe("2020-01-01T00:10:00.000Z");
  });

  it.each(["OPEN", "RESERVED"] as const)("answers undoUntil null for a %s wish", (status) => {
    const card = toOwnerGiftCard(row({ status }));

    expect(card.undoUntil).toBeNull();
  });

  /**
   * D-49: a gift is a surprise, so every reservation looks exactly like an open
   * wish to its owner — whatever the phase, the bought mark or the toggle says.
   */
  it.each([
    ["ACTIVE", false],
    ["AWAITING_GIVER", false],
    ["AWAITING_OWNER", false],
    ["GIVEN", false],
    ["ACTIVE", true],
    ["AWAITING_GIVER", true],
    ["AWAITING_OWNER", true],
    ["GIVEN", true],
  ] as const)(
    "maps a RESERVED %s wish with bought=%s exactly as the same open wish",
    (reservationPhase, reservationBought) => {
      for (const holderVisibleToOwner of [false, true]) {
        const reserved = toOwnerGiftCard(
          row({
            status: "RESERVED",
            reservationPhase,
            reservationBought,
            holderVisibleToOwner,
            reservedBy: HOLDER,
          }),
        );
        const open = toOwnerGiftCard(row({ status: "OPEN" }));

        expect(reserved).toEqual(open);
        expect(reserved.status).toBe("OPEN");
        expect(reserved.reservedBy).toBeNull();
        expect(reserved.ownerAction).toBeNull();
        expect(reserved.reservationLabel).toBeNull();
      }
    },
  );

  /**
   * D-49: closing keeps `reserved*` for audit (AD-8), but the owner still never
   * learns who held the wish — not even when the toggle was on.
   */
  it("keeps the past holder of a closed wish hidden with the toggle on", () => {
    const card = toOwnerGiftCard(
      row({
        status: "CLOSED",
        closedAt: new Date("2026-11-19T12:00:00.000Z"),
        reservationPhase: "GIVEN",
        reservationBought: true,
        holderVisibleToOwner: true,
        reservedBy: HOLDER,
      }),
    );

    expect(card.status).toBe("CLOSED");
    expect(card.reservedBy).toBeNull();
    expect(card.ownerAction).toBeNull();
    expect(card.reservationLabel).toBeNull();
    expect(JSON.stringify(card)).not.toContain(HOLDER.name);
  });

  it("uses the requested locale for a fixed tag label", () => {
    const en = "en" as SupportedLocale;
    const card = toOwnerGiftCard(
      row({
        tags: [
          { tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта", en: "dream" } } },
        ],
      }),
      en,
    );

    expect(card.tags).toEqual([{ catalogId: "tag_dream", label: "dream" }]);
  });
});
