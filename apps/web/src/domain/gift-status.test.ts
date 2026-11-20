import { describe, expect, it } from "vitest";

import {
  EXTENDABLE_RESERVATION_PHASES,
  RESERVATION_RELEASE_DATA,
  UNDO_WINDOW_MS,
  canCloseGift,
  canExtendReservation,
  canSetReservationAttributes,
  canUndoClose,
  closeGiftData,
  hasActiveReservation,
  reservationWarning,
  undoCloseData,
  undoUntil,
  visibilityChangeDropsReservation,
  type GiftStatusEvent,
  type GiftStatusEventKind,
  type HolderAccessInput,
} from "./gift-status";
import { GIFT_EDIT_EVENT_FIELDS, type GiftEditEventField } from "./gift-edit";
import type { ViewerRelations } from "./visibility";

const OWNER_ID = "u1";
const HOLDER_ID = "u2";

function relations(overrides: Partial<Omit<ViewerRelations, "viaListToken">> = {}) {
  return {
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
    ...overrides,
  };
}

function check(overrides: Partial<HolderAccessInput> = {}): HolderAccessInput {
  return {
    status: "RESERVED",
    ownerId: OWNER_ID,
    holderId: HOLDER_ID,
    previousVisibility: "PUBLIC",
    nextVisibility: "FRIENDS",
    relations: relations(),
    ...overrides,
  };
}

describe("visibilityChangeDropsReservation", () => {
  /** FR-10 ред. 2026-11-11: only a live reservation can be lost. */
  it.each(["OPEN", "CLOSED"] as const)("keeps a %s wish's state untouched", (status) => {
    expect(
      visibilityChangeDropsReservation(check({ status, nextVisibility: "SECRET" })),
    ).toBe(false);
  });

  it("keeps the reservation when an accepted friend stays able to see FRIENDS", () => {
    expect(
      visibilityChangeDropsReservation(check({ relations: relations({ friend: true }) })),
    ).toBe(false);
  });

  it("drops the reservation when a non-friend loses FRIENDS", () => {
    expect(visibilityChangeDropsReservation(check())).toBe(true);
  });

  it("drops the reservation when a non-friend loses FRIENDS", () => {
    expect(visibilityChangeDropsReservation(check())).toBe(true);
  });

  it("drops the reservation of a subscriber narrowed from PUBLIC to FRIENDS", () => {
    expect(
      visibilityChangeDropsReservation(check({ relations: relations({ subscriber: true }) })),
    ).toBe(true);
  });

  it("drops the reservation of a contact match narrowed from PUBLIC to FRIENDS", () => {
    expect(
      visibilityChangeDropsReservation(check({ relations: relations({ contactMatch: true }) })),
    ).toBe(true);
  });

  it.each(["PUBLIC", "FRIENDS"] as const)(
    "drops a %s reservation when the owner picks SECRET",
    (previousVisibility) => {
      expect(
        visibilityChangeDropsReservation(
          check({
            previousVisibility,
            nextVisibility: "SECRET",
            relations: relations({ friend: true }),
          }),
        ),
      ).toBe(true);
    },
  );

  /** Widening never brings a released reservation back. */
  it("keeps the reservation when a friend's wish widens from FRIENDS to PUBLIC", () => {
    expect(
      visibilityChangeDropsReservation(
        check({
          previousVisibility: "FRIENDS",
          nextVisibility: "PUBLIC",
          relations: relations({ friend: true }),
        }),
      ),
    ).toBe(false);
  });

  it("does nothing for the same value", () => {
    expect(visibilityChangeDropsReservation(check({ nextVisibility: "PUBLIC" }))).toBe(false);
  });

  /** A-14: a lost relation alone does not cancel the reservation. */
  it("keeps the reservation when the holder is blocked and saw nothing before the change", () => {
    expect(
      visibilityChangeDropsReservation(
        check({ previousVisibility: "FRIENDS", nextVisibility: "SECRET", relations: relations({ blocked: true }) }),
      ),
    ).toBe(false);
  });

  /** SECRET is owner-only: the A-14 reservation card is deliberately not applied here. */
  it("drops the access of a holder who is not the owner, without the reservation-card exception", () => {
    expect(visibilityChangeDropsReservation(check({ nextVisibility: "SECRET" }))).toBe(true);
  });
});

describe("the RESERVED → OPEN release", () => {
  it("sets status to OPEN, clears every reservation column and leaves closure columns alone", () => {
    expect(RESERVATION_RELEASE_DATA).toEqual({
      status: "OPEN",
      reservedById: null,
      reservedAt: null,
      reservationDueAt: null,
      reservationTimeZone: null,
      reservationPhase: null,
      reservationPhaseAt: null,
      reservationBought: false,
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
      titleSnapshotOnReserve: null,
    });
    expect(Object.keys(RESERVATION_RELEASE_DATA).sort()).not.toContain("closedAt");
    expect(Object.keys(RESERVATION_RELEASE_DATA).sort()).not.toContain("closedFromStatus");
  });

  it("keeps the release limited to a live reservation", () => {
    expect(hasActiveReservation({ status: "RESERVED" })).toBe(true);
    expect(hasActiveReservation({ status: "OPEN" })).toBe(false);
    expect(hasActiveReservation({ status: "CLOSED" })).toBe(false);
  });
});

/** Story 5.2 (FR-31, AD-12): the owner's preflight of a foreign reservation. */
describe("reservationWarning", () => {
  it("warns BOUGHT when the holder marked the gift as bought", () => {
    expect(reservationWarning({ status: "RESERVED", reservationBought: true })).toBe("BOUGHT");
  });

  it("answers null when the holder marked nothing", () => {
    expect(reservationWarning({ status: "RESERVED", reservationBought: false })).toBeNull();
  });

  /** PREFLIGHT_STALE: the preflight only reads, so a stale state warns about nothing. */
  it.each(["OPEN", "CLOSED"] as const)("answers null for a %s wish", (status) => {
    expect(reservationWarning({ status, reservationBought: true })).toBeNull();
  });

  /** `GIVEN` is a Story 5.7 branch: 5.2 has no row with that phase and no branch for it. */
  it("never answers GIVEN in Story 5.2", () => {
    const answers = [true, false].map((reservationBought) =>
      reservationWarning({ status: "RESERVED", reservationBought }),
    );
    expect(answers).not.toContain("GIVEN");
  });
});

/** Story 5.3 (FR-32, AD-8): the owner closes an open or reserved, non-archived wish. */
describe("canCloseGift", () => {
  it.each(["OPEN", "RESERVED"] as const)("allows a non-archived %s wish", (status) => {
    expect(canCloseGift({ status, archivedAt: null })).toBe(true);
  });

  it("refuses a CLOSED wish", () => {
    expect(canCloseGift({ status: "CLOSED", archivedAt: null })).toBe(false);
  });

  /** AD-8: an archived wish is read-only, whatever its status. */
  it.each(["OPEN", "RESERVED", "CLOSED"] as const)("refuses an archived %s wish", (status) => {
    expect(canCloseGift({ status, archivedAt: new Date("2026-01-01T00:00:00.000Z") })).toBe(false);
  });
});

/** Story 5.3 (AD-8): the close writes the origin status and keeps the snapshot. */
describe("closeGiftData", () => {
  const at = new Date("2026-11-19T12:00:00.000Z");

  it.each(["OPEN", "RESERVED"] as const)("closes from %s and records the moment", (from) => {
    expect(closeGiftData(from, at)).toEqual({
      status: "CLOSED",
      closedAt: at,
      closedFromStatus: from,
    });
  });

  it("never carries reservation, quantity or visibility columns", () => {
    const keys = Object.keys(closeGiftData("RESERVED", at)).sort();
    expect(keys).toEqual(["closedAt", "closedFromStatus", "status"]);
  });
});

/** Story 5.3 (D-43, ARCH-A5): the undo window is ten minutes, server side. */
describe("canUndoClose", () => {
  const now = new Date("2026-11-19T12:00:00.000Z");
  const tenMinutesAgo = new Date(now.getTime() - UNDO_WINDOW_MS);

  it("has one ten-minute window", () => {
    expect(UNDO_WINDOW_MS).toBe(10 * 60 * 1000);
  });

  /** The boundary is exclusive: at exactly ten minutes the undo is already late. */
  it("refuses a wish closed exactly ten minutes ago", () => {
    expect(canUndoClose({ status: "CLOSED", closedAt: tenMinutesAgo, closedFromStatus: "OPEN" }, now)).toBe(
      false,
    );
  });

  it("allows a wish closed one millisecond inside the window", () => {
    const justInside = new Date(tenMinutesAgo.getTime() + 1);
    expect(
      canUndoClose({ status: "CLOSED", closedAt: justInside, closedFromStatus: "OPEN" }, now),
    ).toBe(true);
  });

  it("refuses a wish closed one millisecond after the window", () => {
    const justOutside = new Date(tenMinutesAgo.getTime() - 1);
    expect(
      canUndoClose({ status: "CLOSED", closedAt: justOutside, closedFromStatus: "RESERVED" }, now),
    ).toBe(false);
  });

  /** UNDO_RACE / UNDO_NO_ORIGIN: no origin status or not closed at all. */
  it.each(["OPEN", "RESERVED"] as const)("refuses a %s wish", (status) => {
    expect(canUndoClose({ status, closedAt: now, closedFromStatus: "OPEN" }, now)).toBe(false);
  });

  it("refuses a closed wish without an origin status", () => {
    expect(canUndoClose({ status: "CLOSED", closedAt: now, closedFromStatus: null }, now)).toBe(false);
  });

  it("refuses a closed wish without a closing moment", () => {
    expect(canUndoClose({ status: "CLOSED", closedAt: null, closedFromStatus: "OPEN" }, now)).toBe(false);
  });
});

/** Story 5.3: the undo restores the origin status and clears only the closure. */
describe("undoCloseData", () => {
  it.each(["OPEN", "RESERVED"] as const)("restores %s and clears the closure columns", (from) => {
    expect(undoCloseData(from)).toEqual({
      status: from,
      closedAt: null,
      closedFromStatus: null,
    });
  });

  it("never carries reservation, quantity or visibility columns", () => {
    expect(Object.keys(undoCloseData("RESERVED")).sort()).toEqual([
      "closedAt",
      "closedFromStatus",
      "status",
    ]);
  });
});

/** Story 5.3 (ARCH-A5): `undoUntil` is `closedAt + UNDO_WINDOW`, returned even after the window. */
describe("undoUntil", () => {
  const closedAt = new Date("2026-11-19T12:00:00.000Z");

  it("adds the window to a closed wish", () => {
    expect(undoUntil({ status: "CLOSED", closedAt })).toEqual(
      new Date(closedAt.getTime() + UNDO_WINDOW_MS),
    );
  });

  it("still answers the moment after the window has passed", () => {
    const old = new Date("2020-01-01T00:00:00.000Z");
    expect(undoUntil({ status: "CLOSED", closedAt: old })).toEqual(
      new Date(old.getTime() + UNDO_WINDOW_MS),
    );
  });

  it.each(["OPEN", "RESERVED"] as const)("answers null for a %s wish", (status) => {
    expect(undoUntil({ status, closedAt })).toBeNull();
  });

  it("answers null for a closed wish without a moment", () => {
    expect(undoUntil({ status: "CLOSED", closedAt: null })).toBeNull();
  });
});

/**
 * Story 5.4 (FR-31): the shape of the two events the seam gained. An edit has no
 * transition and carries field names; a deletion carries the transition the
 * release made and the holder, and never a title or a nick.
 */
describe("the Story 5.4 event payload", () => {
  const at = new Date("2026-11-20T10:00:00.000Z");

  it("keeps the six kinds of the seam", () => {
    const kinds: readonly GiftStatusEventKind[] = [
      "RESERVATION_RELEASED_BY_HOLDER",
      "RESERVATION_RELEASED_BY_OWNER",
      "WISH_CLOSED",
      "WISH_REOPENED",
      "GIFT_EDITED",
      "GIFT_DELETED",
    ];

    expect(new Set(kinds).size).toBe(6);
  });

  it("lets an edit omit the transition and carry field names only", () => {
    const fields: readonly GiftEditEventField[] = ["title", "price"];
    const event: GiftStatusEvent = {
      giftId: "g1",
      actorId: "u1",
      at,
      kind: "GIFT_EDITED",
      fields,
    };

    expect(event.from).toBeUndefined();
    expect(event.to).toBeUndefined();
    expect(event.recipientId).toBeUndefined();
    expect(event.fields).toEqual(["title", "price"]);
  });

  it("accepts only names from the closed set", () => {
    expect([...GIFT_EDIT_EVENT_FIELDS]).toEqual(["title", "description", "linkUrl", "price"]);

    const event: GiftStatusEvent = {
      giftId: "g1",
      actorId: "u1",
      at,
      kind: "GIFT_EDITED",
      fields: GIFT_EDIT_EVENT_FIELDS,
    };
    // A name outside the set, e.g. a tag or a visibility value, is not reportable.
    expect(event.fields).not.toContain("tags");
    expect(event.fields).not.toContain("visibility");
  });

  it("carries the RESERVED → OPEN transition and the holder on a deletion", () => {
    const event: GiftStatusEvent = {
      giftId: "g1",
      actorId: "u1",
      from: "RESERVED",
      to: "OPEN",
      at,
      kind: "GIFT_DELETED",
      recipientId: "u2",
    };

    expect(event).toMatchObject({
      kind: "GIFT_DELETED",
      from: "RESERVED",
      to: "OPEN",
      recipientId: "u2",
    });
    expect(event.fields).toBeUndefined();
  });
});

/**
 * Story 5.5 (AD-9): an extension leaves only ACTIVE/AWAITING_*; «Купил» and the
 * toggles are attributes of any live reservation, `GIVEN` included.
 */
describe("reservation attributes of Story 5.5", () => {
  it.each(EXTENDABLE_RESERVATION_PHASES)(
    "allows extending a RESERVED %s reservation",
    (phase) => {
      expect(canExtendReservation({ status: "RESERVED", reservationPhase: phase })).toBe(true);
    },
  );

  /** «Ждёт подтверждения» stops the timers (Story 5.7), so an extension is refused. */
  it("refuses to extend a GIVEN reservation", () => {
    expect(canExtendReservation({ status: "RESERVED", reservationPhase: "GIVEN" })).toBe(false);
  });

  it.each(["OPEN", "CLOSED"] as const)(
    "refuses a %s wish even with a leftover phase",
    (status) => {
      expect(canExtendReservation({ status, reservationPhase: "ACTIVE" })).toBe(false);
    },
  );

  it("refuses an incomplete reservation without a phase", () => {
    expect(canExtendReservation({ status: "RESERVED", reservationPhase: null })).toBe(false);
  });

  it("keeps the extendable list exactly ACTIVE and both AWAITING phases", () => {
    expect([...EXTENDABLE_RESERVATION_PHASES]).toEqual([
      "ACTIVE",
      "AWAITING_GIVER",
      "AWAITING_OWNER",
    ]);
    expect([...EXTENDABLE_RESERVATION_PHASES]).not.toContain("GIVEN");
  });

  it.each(["OPEN", "RESERVED", "CLOSED"] as const)(
    "answers %s for the attribute writes by status alone",
    (status) => {
      expect(canSetReservationAttributes({ status })).toBe(status === "RESERVED");
    },
  );
});
