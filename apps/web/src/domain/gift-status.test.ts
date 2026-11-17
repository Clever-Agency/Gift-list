import { describe, expect, it } from "vitest";

import {
  RESERVATION_RELEASE_DATA,
  hasActiveReservation,
  visibilityChangeDropsReservation,
  type HolderAccessInput,
} from "./gift-status";
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
