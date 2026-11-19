import { giftCardSchema, type SupportedLocale } from "@gift-list/contracts";
import { describe, expect, it } from "vitest";
import { toOwnerGiftCard, type OwnerGiftRow } from "./owner-gift-card";

const HOLDER_ID = "holder1";
const HOLDER = { id: HOLDER_ID, nick: "holder", name: "Holder Name" };
const HOLDER_ON_WIRE = { id: HOLDER_ID, nick: "holder", displayName: "Holder Name" };

function row(overrides: Partial<OwnerGiftRow> = {}): OwnerGiftRow {
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
    reservationPhase: null,
    holderVisibleToOwner: false,
    reservedBy: null,
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

  /** CLOSED keeps reserved* for audit: the holder follows the owner's toggle. */
  it("shows the holder of a closed wish by the owner toggle", () => {
    const shown = toOwnerGiftCard(
      row({ status: "CLOSED", reservationPhase: "GIVEN", holderVisibleToOwner: true, reservedBy: HOLDER }),
    );
    const hidden = toOwnerGiftCard(
      row({ status: "CLOSED", holderVisibleToOwner: false, reservedBy: HOLDER }),
    );

    expect(shown.reservedBy).toEqual(HOLDER_ON_WIRE);
    expect(hidden.reservedBy).toBeNull();
  });

  it("keeps reservationLabel and ownerAction empty on a closed wish", () => {
    const card = toOwnerGiftCard(
      row({ status: "CLOSED", reservationPhase: "AWAITING_OWNER", reservedBy: HOLDER }),
    );

    expect(card.reservationLabel).toBeNull();
    expect(card.ownerAction).toBeNull();
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
