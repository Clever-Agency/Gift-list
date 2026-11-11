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
  it("clears the reservation columns of a RESERVED row through one CAS write", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    const released = await giftStatusTransaction(transactionClient()).releaseReservation("g1");

    expect(released).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED" },
      data: RESERVATION_RELEASE_DATA,
    });
  });

  it("writes nothing for a row that is no longer reserved", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const released = await giftStatusTransaction(transactionClient()).releaseReservation("g1");

    expect(released).toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
