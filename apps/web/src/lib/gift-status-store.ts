import "server-only";

import type { Prisma } from "@/db/generated/client";
import {
  RESERVATION_RELEASE_DATA,
  type GiftStatusTransaction,
} from "@/domain/gift-status";

/**
 * Prisma adapter of `GiftStatusService` (AD-8 / AD-9). This is the only place
 * that writes `Gift.status` and the reservation columns. It receives the
 * caller's transaction client instead of opening its own, so the status write
 * and the field write of one use-case commit or roll back together.
 *
 * First slice (CLE-82/S23.2): the owner's `RESERVED → OPEN` release only. The
 * CAS on `status: "RESERVED"` means a row that changed status in the meantime
 * is left untouched; `false` says the reservation was already gone.
 */
export function giftStatusTransaction(tx: Prisma.TransactionClient): GiftStatusTransaction {
  return {
    async releaseReservation(giftId) {
      const { count } = await tx.gift.updateMany({
        where: { id: giftId, status: "RESERVED" },
        data: RESERVATION_RELEASE_DATA,
      });
      return count === 1;
    },
  };
}
