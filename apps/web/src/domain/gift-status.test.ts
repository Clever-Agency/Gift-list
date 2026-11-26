import { describe, expect, it } from "vitest";

import {
  EXTENDABLE_RESERVATION_PHASES,
  GIVABLE_RESERVATION_PHASES,
  RESERVATION_GIVER_WINDOW_MS,
  RESERVATION_OWNER_WINDOW_MS,
  RESERVATION_RELEASE_DATA,
  UNDO_CLOSE_WITHOUT_HOLDER_DATA,
  UNDO_WINDOW_MS,
  canAskOwner,
  canCloseGift,
  canExpireToGiver,
  canExtendReservation,
  canMarkReservationGiven,
  canReleaseByExpiry,
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
  type ReservationDueRow,
  type ReservationPhaseMomentRow,
  type ReservationReleaseRow,
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

/** CLE-134: a `RESERVED` closure without its holder returns to `OPEN`, never to a ghost reservation. */
describe("UNDO_CLOSE_WITHOUT_HOLDER_DATA", () => {
  it("returns the wish to OPEN, clears every reservation column and the closure", () => {
    expect(UNDO_CLOSE_WITHOUT_HOLDER_DATA).toEqual({
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
      closedAt: null,
      closedFromStatus: null,
    });
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

  it("keeps the five kinds of the seam", () => {
    const kinds: readonly GiftStatusEventKind[] = [
      "RESERVATION_RELEASED_BY_HOLDER",
      "WISH_CLOSED",
      "WISH_REOPENED",
      "GIFT_EDITED",
      "GIFT_DELETED",
    ];

    expect(new Set(kinds).size).toBe(5);
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
 * Story 5.5, CLE-124/S9b-2 (Story 5.7): an extension leaves only `ACTIVE` and
 * only while the deadline is ahead; «Подарил» moves any live phase to `GIVEN`.
 */
describe("reservation attributes of Story 5.5", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  it.each(EXTENDABLE_RESERVATION_PHASES)(
    "allows extending a RESERVED %s reservation before its deadline",
    (phase) => {
      expect(
        canExtendReservation({ status: "RESERVED", reservationPhase: phase, reservationDueAt: future }, now),
      ).toBe(true);
    },
  );

  it.each(["GIVEN", "AWAITING_GIVER", "AWAITING_OWNER"] as const)(
    "refuses to extend a %s reservation even with a future deadline",
    (phase) => {
      expect(
        canExtendReservation({ status: "RESERVED", reservationPhase: phase, reservationDueAt: future }, now),
      ).toBe(false);
    },
  );

  /** CLE-124/S9b-2: the deadline itself is already too late — step 1 moves it then. */
  it("refuses an extension at, before and without a deadline", () => {
    for (const dueAt of [now, new Date(now.getTime() - 1), null]) {
      expect(
        canExtendReservation({ status: "RESERVED", reservationPhase: "ACTIVE", reservationDueAt: dueAt }, now),
      ).toBe(false);
    }
  });

  it.each(["OPEN", "CLOSED"] as const)(
    "refuses a %s wish even with a leftover phase",
    (status) => {
      expect(
        canExtendReservation({ status, reservationPhase: "ACTIVE", reservationDueAt: future }, now),
      ).toBe(false);
    },
  );

  it("refuses an incomplete reservation without a phase", () => {
    expect(
      canExtendReservation({ status: "RESERVED", reservationPhase: null, reservationDueAt: future }, now),
    ).toBe(false);
  });

  it.each(GIVABLE_RESERVATION_PHASES)(
    "marks a RESERVED %s reservation as given",
    (phase) => {
      expect(canMarkReservationGiven({ status: "RESERVED", reservationPhase: phase })).toBe(true);
    },
  );

  it.each(["GIVEN", null] as const)("does not move a %s reservation again", (phase) => {
    expect(canMarkReservationGiven({ status: "RESERVED", reservationPhase: phase })).toBe(false);
  });

  it.each(["OPEN", "CLOSED"] as const)("does not mark a %s wish as given", (status) => {
    expect(canMarkReservationGiven({ status, reservationPhase: null })).toBe(false);
  });

  it("keeps the extendable list exactly ACTIVE", () => {
    expect([...EXTENDABLE_RESERVATION_PHASES]).toEqual(["ACTIVE"]);
    expect([...EXTENDABLE_RESERVATION_PHASES]).not.toContain("GIVEN");
  });

  it.each(["OPEN", "RESERVED", "CLOSED"] as const)(
    "answers %s for the attribute writes by status alone",
    (status) => {
      expect(canSetReservationAttributes({ status })).toBe(status === "RESERVED");
    },
  );
});

/** Story 5.6 (AD-9): the reservation cycle, three steps and no owner answer. */
describe("the Story 5.6 reservation timers", () => {
  const now = new Date("2026-11-20T12:00:00.000Z");

  function dueRow(overrides: Partial<ReservationDueRow> = {}): ReservationDueRow {
    return {
      status: "RESERVED",
      archivedAt: null,
      reservationPhase: "ACTIVE",
      reservationDueAt: now,
      ...overrides,
    };
  }

  function momentRow(
    overrides: Partial<ReservationPhaseMomentRow> = {},
  ): ReservationPhaseMomentRow {
    return {
      status: "RESERVED",
      archivedAt: null,
      reservationPhase: "AWAITING_GIVER",
      reservationPhaseAt: now,
      ...overrides,
    };
  }

  function releaseRow(overrides: Partial<ReservationReleaseRow> = {}): ReservationReleaseRow {
    return {
      status: "RESERVED",
      archivedAt: null,
      reservationPhase: "AWAITING_OWNER",
      reservationPhaseAt: new Date(now.getTime() - 60_000),
      reservationDueAt: new Date(now.getTime() - RESERVATION_OWNER_WINDOW_MS),
      ...overrides,
    };
  }

  it("uses the two windows AD-9 names", () => {
    expect(RESERVATION_GIVER_WINDOW_MS).toBe(72 * 60 * 60 * 1000);
    expect(RESERVATION_OWNER_WINDOW_MS).toBe(168 * 60 * 60 * 1000);
  });

  describe("canExpireToGiver", () => {
    /** `dueAt ≤ now`: at exactly the deadline the step already happens. */
    it("moves at the deadline and after it", () => {
      expect(canExpireToGiver(dueRow(), now)).toBe(true);
      expect(canExpireToGiver(dueRow({ reservationDueAt: new Date(now.getTime() - 1) }), now)).toBe(
        true,
      );
    });

    it("waits one millisecond past the deadline", () => {
      expect(
        canExpireToGiver(dueRow({ reservationDueAt: new Date(now.getTime() + 1) }), now),
      ).toBe(false);
    });

    it.each(["AWAITING_GIVER", "AWAITING_OWNER", "GIVEN", null] as const)(
      "refuses the %s phase",
      (reservationPhase) => {
        expect(canExpireToGiver(dueRow({ reservationPhase }), now)).toBe(false);
      },
    );

    it.each(["OPEN", "CLOSED"] as const)("refuses a %s wish", (status) => {
      expect(canExpireToGiver(dueRow({ status }), now)).toBe(false);
    });

    /** CRON_ARCHIVED: an archived wish is read-only (AD-8). */
    it("refuses an archived wish", () => {
      expect(canExpireToGiver(dueRow({ archivedAt: now }), now)).toBe(false);
    });

    it("refuses a reservation without a deadline", () => {
      expect(canExpireToGiver(dueRow({ reservationDueAt: null }), now)).toBe(false);
    });
  });

  describe("canAskOwner", () => {
    /** `phaseAt ≤ now − 72 ч`: the boundary is inclusive. */
    it("asks at exactly 72 hours and later", () => {
      const boundary = new Date(now.getTime() - RESERVATION_GIVER_WINDOW_MS);
      expect(canAskOwner(momentRow({ reservationPhaseAt: boundary }), now)).toBe(true);
      expect(canAskOwner(momentRow({ reservationPhaseAt: new Date(boundary.getTime() - 1) }), now)).toBe(
        true,
      );
    });

    it("waits one millisecond inside the window", () => {
      const boundary = new Date(now.getTime() - RESERVATION_GIVER_WINDOW_MS + 1);
      expect(canAskOwner(momentRow({ reservationPhaseAt: boundary }), now)).toBe(false);
    });

    it.each(["ACTIVE", "AWAITING_OWNER", "GIVEN", null] as const)(
      "refuses the %s phase",
      (reservationPhase) => {
        expect(canAskOwner(momentRow({ reservationPhase }), now)).toBe(false);
      },
    );

    it.each(["OPEN", "CLOSED"] as const)("refuses a %s wish", (status) => {
      expect(canAskOwner(momentRow({ status }), now)).toBe(false);
    });

    it("refuses an archived wish and a phase without a moment", () => {
      expect(canAskOwner(momentRow({ archivedAt: now }), now)).toBe(false);
      expect(canAskOwner(momentRow({ reservationPhaseAt: null }), now)).toBe(false);
    });
  });

  describe("canReleaseByExpiry", () => {
    /** CLE-124/D-49/S9b-1: `dueAt ≤ now − 168 ч` and a phase not started now. */
    it("releases when the deadline is at least 168 hours old", () => {
      const boundary = new Date(now.getTime() - RESERVATION_OWNER_WINDOW_MS);
      expect(canReleaseByExpiry(releaseRow({ reservationDueAt: boundary }), now)).toBe(true);
      expect(
        canReleaseByExpiry(
          releaseRow({ reservationDueAt: new Date(boundary.getTime() - 1) }),
          now,
        ),
      ).toBe(true);
    });

    it("waits while the deadline is one millisecond inside the window", () => {
      const inside = new Date(now.getTime() - RESERVATION_OWNER_WINDOW_MS + 1);
      expect(canReleaseByExpiry(releaseRow({ reservationDueAt: inside }), now)).toBe(false);
    });

    it("counts from the deadline, not from the moment the phase started", () => {
      expect(
        canReleaseByExpiry(
          releaseRow({
            reservationDueAt: new Date(now.getTime() - 200 * 60 * 60 * 1000),
            reservationPhaseAt: new Date(now.getTime() - 60 * 60 * 1000),
          }),
          now,
        ),
      ).toBe(true);
    });

    /** A row moved to the phase by step 2 of this run waits for the next run. */
    it("refuses a row whose phase started exactly now", () => {
      expect(canReleaseByExpiry(releaseRow({ reservationPhaseAt: now }), now)).toBe(false);
    });

    /** CLE-124/S9b-1: a promise («Подарил») does not protect it either. */
    it("releases a GIVEN reservation once the deadline is 168 hours old", () => {
      expect(
        canReleaseByExpiry(
          releaseRow({ reservationPhase: "GIVEN", reservationDueAt: new Date(now.getTime() - 169 * 60 * 60 * 1000) }),
          now,
        ),
      ).toBe(true);
      expect(
        canReleaseByExpiry(
          releaseRow({ reservationPhase: "GIVEN", reservationDueAt: new Date(now.getTime() - 167 * 60 * 60 * 1000) }),
          now,
        ),
      ).toBe(false);
    });

    it.each(["ACTIVE", "AWAITING_GIVER", null] as const)(
      "refuses the %s phase",
      (reservationPhase) => {
        expect(canReleaseByExpiry(releaseRow({ reservationPhase }), now)).toBe(false);
      },
    );

    it.each(["OPEN", "CLOSED"] as const)("refuses a %s wish", (status) => {
      expect(canReleaseByExpiry(releaseRow({ status }), now)).toBe(false);
    });

    it("refuses an archived wish, a missing deadline and a missing phase moment", () => {
      expect(canReleaseByExpiry(releaseRow({ archivedAt: now }), now)).toBe(false);
      expect(canReleaseByExpiry(releaseRow({ reservationDueAt: null }), now)).toBe(false);
      expect(canReleaseByExpiry(releaseRow({ reservationPhaseAt: null }), now)).toBe(false);
    });
  });
});

/**
 * Story 5.6 (NFR-6): the reservation-timer kinds join the seam. The two phase
 * moves keep `RESERVED → RESERVED`, so the `kind` is what tells them apart; a
 * timer transition has no actor.
 */
describe("the Story 5.6 event payload", () => {
  const at = new Date("2026-11-20T12:00:00.000Z");

  it("adds the reservation-timer and wish-expiry kinds to the seam", () => {
    const kinds: Record<GiftStatusEventKind, true> = {
      RESERVATION_RELEASED_BY_HOLDER: true,
      WISH_CLOSED: true,
      WISH_REOPENED: true,
      GIFT_EDITED: true,
      GIFT_DELETED: true,
      RESERVATION_GIVER_DEADLINE_PASSED: true,
      RESERVATION_OWNER_WINDOW_STARTED: true,
      RESERVATION_RELEASED_BY_EXPIRY: true,
      RESERVATION_RELEASED_BY_ACCOUNT_DELETION: true,
      WISH_EXPIRED_AND_ARCHIVED: true,
    };

    expect(Object.keys(kinds)).toHaveLength(10);
  });

  it("lets a timer transition carry no actor and a phase-only change", () => {
    const event: GiftStatusEvent = {
      giftId: "g1",
      actorId: null,
      from: "RESERVED",
      to: "RESERVED",
      at,
      kind: "RESERVATION_OWNER_WINDOW_STARTED",
    };

    expect(event.actorId).toBeNull();
    expect(event.from).toBe(event.to);
    expect(event.fields).toBeUndefined();
    expect(event.recipientId).toBeUndefined();
  });
});
