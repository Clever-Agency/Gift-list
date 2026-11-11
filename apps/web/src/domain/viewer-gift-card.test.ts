import { giftCardSchema, type SupportedLocale } from "@gift-list/contracts";
import { describe, expect, it } from "vitest";
import { toViewerGiftCard, type ViewerGiftRow } from "./viewer-gift-card";

const HOLDER_ID = "holder1";
const OTHER_ID = "other1";
const HOLDER = { id: HOLDER_ID, nick: "holder", name: "Holder Name" };
const HOLDER_ON_WIRE = { id: HOLDER_ID, nick: "holder", displayName: "Holder Name" };

function row(overrides: Partial<ViewerGiftRow> = {}): ViewerGiftRow {
  return {
    id: "g1",
    title: "Наушники",
    description: "Беспроводные",
    priceAmount: 12900,
    priceCurrency: "USD",
    linkUrl: "https://example.com/headphones",
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: new Date("2026-12-31T00:00:00.000Z"),
    archivedAt: null,
    status: "RESERVED",
    reservationPhase: "ACTIVE",
    holderVisibleToOwner: false,
    reservedBy: HOLDER,
    reservationBought: false,
    holderVisibleToOthers: true,
    tags: [],
    ...overrides,
  };
}

describe("toViewerGiftCard", () => {
  it("returns a card the strict contract accepts, with no owner-only keys", () => {
    const card = toViewerGiftCard(row({ status: "RESERVED" }), OTHER_ID);

    expect(giftCardSchema.parse(card)).toEqual(card);
    expect(card.expiresOn).toBe("2026-12-31");
    expect(card.tags).toEqual([]);
    expect(card.ownerAction).toBeNull();
    expect(card).not.toHaveProperty("bought");
    expect(card).not.toHaveProperty("dueAt");
    expect(card).not.toHaveProperty("phase");
  });

  it("shows the holder to themself while the reservation is live", () => {
    const card = toViewerGiftCard(
      row({ holderVisibleToOthers: false, holderVisibleToOwner: false }),
      HOLDER_ID,
    );

    expect(card.reservedBy).toEqual(HOLDER_ON_WIRE);
  });

  it("hides the holder from others while the toggle is off", () => {
    const card = toViewerGiftCard(row({ holderVisibleToOthers: false }), OTHER_ID);

    expect(card.reservedBy).toBeNull();
    expect(card.reservationLabel).toBeNull();
  });

  it("ignores the owner-only toggle for non-owners", () => {
    const card = toViewerGiftCard(
      row({ holderVisibleToOwner: true, holderVisibleToOthers: false }),
      OTHER_ID,
    );

    expect(card.reservedBy).toBeNull();
  });

  it("shows the holder to others while the toggle is on", () => {
    const card = toViewerGiftCard(row({ holderVisibleToOthers: true }), OTHER_ID);

    expect(card.reservedBy).toEqual(HOLDER_ON_WIRE);
  });

  it("allows a RESERVED card without a holder row", () => {
    const card = toViewerGiftCard(
      row({ reservedBy: null, holderVisibleToOthers: true }),
      OTHER_ID,
    );

    expect(card.reservedBy).toBeNull();
  });

  it("labels a given reservation as GIVEN", () => {
    const card = toViewerGiftCard(
      row({ reservationPhase: "GIVEN", reservationBought: true }),
      OTHER_ID,
    );

    expect(card.reservationLabel).toBe("GIVEN");
  });

  it("labels a bought reservation as BOUGHT", () => {
    const card = toViewerGiftCard(
      row({ reservationPhase: "AWAITING_OWNER", reservationBought: true }),
      OTHER_ID,
    );

    expect(card.reservationLabel).toBe("BOUGHT");
  });

  it("has no label while nothing was bought or given", () => {
    const card = toViewerGiftCard(row({ reservationBought: false }), HOLDER_ID);

    expect(card.reservationLabel).toBeNull();
  });

  it("drops leftover reservation columns on an OPEN gift", () => {
    const card = toViewerGiftCard(
      row({
        status: "OPEN",
        reservationPhase: "GIVEN",
        reservationBought: true,
        holderVisibleToOthers: true,
      }),
      HOLDER_ID,
    );

    expect(card.reservedBy).toBeNull();
    expect(card.reservationLabel).toBeNull();
  });

  it("keeps the holder on a CLOSED gift by the toggle but never a label", () => {
    const shown = toViewerGiftCard(
      row({
        status: "CLOSED",
        reservationPhase: "GIVEN",
        reservationBought: true,
        holderVisibleToOthers: true,
      }),
      OTHER_ID,
    );
    const hidden = toViewerGiftCard(
      row({ status: "CLOSED", holderVisibleToOthers: false }),
      HOLDER_ID,
    );

    expect(shown.reservedBy).toEqual(HOLDER_ON_WIRE);
    expect(shown.reservationLabel).toBeNull();
    expect(hidden.reservedBy).toBeNull();
  });

  it("never exposes an owner action, even mid-reservation", () => {
    for (const phase of ["AWAITING_OWNER", "GIVEN"] as const) {
      const card = toViewerGiftCard(
        row({ reservationPhase: phase, reservationBought: phase === "GIVEN" }),
        HOLDER_ID,
      );

      expect(card.ownerAction).toBeNull();
    }
  });

  it("never treats an anonymous viewer as the holder", () => {
    const card = toViewerGiftCard(
      row({
        reservedBy: { id: "anonymous", nick: "guest", name: "Guest" },
        holderVisibleToOthers: false,
        reservationPhase: "GIVEN",
      }),
      null,
    );

    expect(card.reservedBy).toBeNull();
    expect(card.reservationLabel).toBe("GIVEN");
  });

  /** Story 2.5/AD-27: the viewer gets the server-resolved label and the custom text. */
  it("maps fixed and custom tags for a viewer", () => {
    const card = toViewerGiftCard(
      row({
        tags: [
          { tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта" } } },
          { tagId: null, customText: "своё", tag: null },
        ],
      }),
      OTHER_ID,
    );

    expect(card.tags).toEqual([
      { catalogId: null, label: "своё" },
      { catalogId: "tag_dream", label: "мечта" },
    ]);
    expect(giftCardSchema.safeParse(card).success).toBe(true);
  });

  /** AD-27: the label follows the requested locale, not a caption baked into code. */
  it("uses the requested locale for a fixed tag label", () => {
    const futureLocale = "en" as SupportedLocale;

    const card = toViewerGiftCard(
      row({
        tags: [
          { tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта", en: "dream" } } },
        ],
      }),
      OTHER_ID,
      futureLocale,
    );

    expect(card.tags).toEqual([{ catalogId: "tag_dream", label: "dream" }]);
  });
});
