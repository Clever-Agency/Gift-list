import "server-only";

import {
  PERSONAL_DATES_MAX,
  isValidPersonalDate,
  type DateVisibility,
  type PersonalDateCreateBody,
  type PersonalDateUpdateBody,
  type UserDateKind,
} from "@gift-list/contracts";
import { prisma } from "@/db/client";
import type { PersonalDateStored } from "@/domain/personal-dates";

/**
 * Columns the contract answers with (AD-12, AD-23). `userId`, timestamps and
 * every other column stay in the database: a date row is nine fields, no owner
 * id and no e-mail.
 */
export const personalDateSelect = {
  id: true,
  kind: true,
  title: true,
  day: true,
  month: true,
  year: true,
  visibility: true,
  yearVisibility: true,
} as const;

/** The Prisma row this adapter hands to the domain policy. */
type PersonalDateRow = {
  readonly id: string;
  readonly kind: UserDateKind;
  readonly title: string;
  readonly day: number;
  readonly month: number;
  readonly year: number | null;
  readonly visibility: DateVisibility;
  readonly yearVisibility: DateVisibility;
};

function stored(row: PersonalDateRow, ownerId: string): PersonalDateStored {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    day: row.day,
    month: row.month,
    year: row.year,
    visibility: row.visibility,
    yearVisibility: row.yearVisibility,
    ownerId,
  };
}

/**
 * Every stored date of one user, oldest first. The owner's list is at most
 * `PERSONAL_DATES_MAX` rows (AD-23), so no cursor is needed; `id` keeps the
 * order stable when two rows share a timestamp. The profile read uses the same
 * function and lets `domain/personal-dates.ts` decide what the viewer gets.
 */
export async function readPersonalDates(userId: string): Promise<PersonalDateStored[]> {
  const rows = await prisma.userDate.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: personalDateSelect,
  });
  return rows.map(function toStored(row) {
    return stored(row, userId);
  });
}

export type CreatePersonalDateResult =
  | { readonly ok: true; readonly date: PersonalDateStored }
  | { readonly ok: false; readonly reason: "limit" };

/**
 * Story 7.5 (AD-23): the owner adds a date; the eleventh is refused.
 *
 * The count and the insert share one transaction, and the transaction first
 * takes `pg_advisory_xact_lock` on the user id (the same plain PostgreSQL tool
 * `friendship-store` uses for a pair). Two simultaneous creates of one user
 * therefore run one after the other and the second reads the first committed
 * row — without the lock both could see nine rows and insert an eleventh. The
 * lock is transaction-scoped, so a commit or a rollback releases it.
 */
export async function createPersonalDate(
  userId: string,
  input: PersonalDateCreateBody,
): Promise<CreatePersonalDateResult> {
  return prisma.$transaction(async function createWithinLimit(tx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`personal-dates:${userId}`}, 0))`;

    const count = await tx.userDate.count({
      where: { userId, kind: "CUSTOM" },
    });
    if (count >= PERSONAL_DATES_MAX) return { ok: false, reason: "limit" } as const;

    const row = await tx.userDate.create({
      data: {
        userId,
        kind: "CUSTOM",
        title: input.title,
        day: input.day,
        month: input.month,
        year: input.year ?? null,
        visibility: input.visibility,
        yearVisibility: input.yearVisibility,
      },
      select: personalDateSelect,
    });
    return { ok: true, date: stored(row, userId) } as const;
  });
}

export type UpdatePersonalDateResult =
  | { readonly ok: true; readonly date: PersonalDateStored }
  | { readonly ok: false; readonly reason: "not-found" }
  | { readonly ok: false; readonly reason: "invalid"; readonly field: "day" };

/**
 * Story 7.5 (AD-23): the owner edits one own date. A foreign id is answered
 * exactly like a missing one — the read and both writes carry `userId`, so a
 * date of somebody else never resolves.
 *
 * The contract can check a body that changes day and month together, but a
 * body that touches only the year cannot know the stored day and month. The
 * merged row is checked here again, so 29 February plus a non-leap year is
 * refused even when the request carried only `{ year }` (S1-1 risk).
 */
export async function updatePersonalDate(
  userId: string,
  id: string,
  input: PersonalDateUpdateBody,
): Promise<UpdatePersonalDateResult> {
  const current = await prisma.userDate.findFirst({
    where: { id, userId },
    select: personalDateSelect,
  });
  if (current === null) return { ok: false, reason: "not-found" } as const;

  const day = input.day ?? current.day;
  const month = input.month ?? current.month;
  const year = input.year === undefined ? current.year : input.year;
  if (!isValidPersonalDate(day, month, year)) {
    return { ok: false, reason: "invalid", field: "day" } as const;
  }

  const { count } = await prisma.userDate.updateMany({
    where: { id, userId },
    data: {
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.day === undefined ? {} : { day: input.day }),
      ...(input.month === undefined ? {} : { month: input.month }),
      ...(input.year === undefined ? {} : { year: input.year }),
      ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
      ...(input.yearVisibility === undefined ? {} : { yearVisibility: input.yearVisibility }),
    },
  });
  if (count === 0) return { ok: false, reason: "not-found" } as const;

  const row = await prisma.userDate.findFirst({
    where: { id, userId },
    select: personalDateSelect,
  });
  if (row === null) return { ok: false, reason: "not-found" } as const;
  return { ok: true, date: stored(row, userId) } as const;
}

/** Story 7.5: the owner removes one own date; a foreign id removes nothing. */
export async function deletePersonalDate(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.userDate.deleteMany({ where: { id, userId } });
  return count > 0;
}
