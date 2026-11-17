// GiftStatusService (AD-8, AD-9). Story 2.6 owns expiry and restore only.
// Reservation transitions stay with Story 5.1, which extends this class.

import type { PrismaClient } from "@/db/generated/client";
import { prisma } from "@/db/client";
import { calendarDay, calendarDayToDate, isBeforeLocalToday } from "@/domain/calendar-day";

type StatusDb = Pick<PrismaClient, "gift">;

/**
 * The only writer of `archivedAt` (AD-8). Each transition is one CAS update:
 * `count !== 1` means a concurrent change won, and this call changes nothing.
 */
export class GiftStatusService {
  constructor(private readonly db: StatusDb = prisma) {}

  /**
   * Archive `OPEN` wishes whose owner's local date is later than `expiresOn`.
   * `RESERVED` and `CLOSED` are not candidates (Story 6.6). A second run finds
   * nothing left to archive.
   */
  async processWishExpiry(now: Date = new Date()): Promise<{ archived: number }> {
    const rows = await this.db.gift.findMany({
      where: { status: "OPEN", archivedAt: null, expiresOn: { not: null } },
      select: {
        id: true,
        expiresOn: true,
        list: { select: { owner: { select: { timeZone: true } } } },
      },
    });

    let archived = 0;
    for (const row of rows) {
      const day = calendarDay(row.expiresOn);
      if (day === null || !isBeforeLocalToday(day, now, row.list.owner.timeZone)) continue;
      const result = await this.db.gift.updateMany({
        where: { id: row.id, status: "OPEN", archivedAt: null },
        data: { archivedAt: now },
      });
      archived += result.count;
    }
    return { archived };
  }

  /**
   * Owner puts an archived `OPEN` wish back. The date is replaced in the same
   * update that clears `archivedAt`. A past day is refused before the write.
   */
  async restoreFromArchive(input: {
    giftId: string;
    ownerId: string;
    expiresOn: string | null;
    timeZone: string | null;
    now?: Date;
  }): Promise<"ok" | "missing" | "past"> {
    const now = input.now ?? new Date();
    if (
      input.expiresOn !== null &&
      isBeforeLocalToday(input.expiresOn, now, input.timeZone)
    ) {
      return "past";
    }

    const result = await this.db.gift.updateMany({
      where: {
        id: input.giftId,
        status: "OPEN",
        NOT: { archivedAt: null },
        list: { ownerId: input.ownerId },
      },
      data: {
        archivedAt: null,
        expiresOn: input.expiresOn === null ? null : calendarDayToDate(input.expiresOn),
      },
    });
    return result.count === 1 ? "ok" : "missing";
  }
}
