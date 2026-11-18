import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { Prisma } from "@/db/generated/client";
import { RESERVATION_RELEASE_DATA } from "@/domain/gift-status";
import { giftStatusTransaction } from "./gift-status-store";

const updateMany = vi.fn();

function transactionClient(): Prisma.TransactionClient {
  return { gift: { updateMany } } as unknown as Prisma.TransactionClient;
}

beforeEach(() => {
  updateMany.mockReset();
});

describe("giftStatusTransaction.releaseReservation", () => {
  it("writes status OPEN and clears the reservation columns of a RESERVED row through one CAS write", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    const released = await giftStatusTransaction(transactionClient()).releaseReservation("g1");

    expect(released).toBe(true);
    expect(RESERVATION_RELEASE_DATA.status).toBe("OPEN");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED" },
      data: RESERVATION_RELEASE_DATA,
    });
  });

  it("reserves an OPEN SINGLE row with CAS and answers lost when the row moved", async () => {
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const tx = giftStatusTransaction(transactionClient());
    const at = new Date("2026-06-15T10:00:00.000Z");
  const data = {
    reservedById: "u2",
      reservedAt: at,
      titleSnapshotOnReserve: "Gift",
      reservationDueAt: new Date("2026-06-22T00:00:00.000Z"),
      reservationTimeZone: "UTC",
      reservationPhaseAt: at,
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
    };

    await expect(tx.reserveGift("g1", data)).resolves.toBe("success");
    await expect(tx.reserveGift("g1", data)).resolves.toBe("lost");
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "g1", status: "OPEN", quantity: "SINGLE", archivedAt: null },
      data: {
        status: "RESERVED",
        reservedById: "u2",
        reservedAt: at,
        titleSnapshotOnReserve: "Gift",
        reservationDueAt: data.reservationDueAt,
        reservationTimeZone: "UTC",
        reservationPhase: "ACTIVE",
        reservationPhaseAt: at,
        reservationBought: false,
        holderVisibleToOwner: false,
        holderVisibleToOthers: true,
      },
    });
  });

  it("writes nothing for a row that is no longer reserved", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const released = await giftStatusTransaction(transactionClient()).releaseReservation("g1");

    expect(released).toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
