// AD-15 (6) and (7): the reservation timer (`processReservationTimers`, Story
// 5.6) against the two rows it must never move and against a user who wins the
// race between the candidate read and the CAS.
//
// The two invariants are checked on a stateful fake, not on spies: `findMany`
// returns a row only when the production query's own predicate matches it, and
// `updateMany` applies the very same predicate before it writes. A widened
// query or a missing CAS condition therefore shows up as a real transition
// (`released = 1`), an audit line and cleared reservation columns — not as an
// assertion about the shape of the arguments.
//
// The canonical per-piece tests stay where they are and are not repeated here:
// `domain/gift-status.test.ts` (the release rule and `bought`),
// `lib/gift-status-store.test.ts` (the three timer steps, the CAS predicates,
// the lost CAS of the keeper action) and
// `actions/gift-reservation-keep.test.ts` (the opposite direction: the user
// loses to the timer and gets CONFLICT). What none of them has is this
// scenario: the whole cron run over a `bought = true` row, a `GIVEN` row, and
// a row the user changed after it was read as a candidate.
//
// This is not the real PostgreSQL race: two simultaneous transactions on one
// row are proven only in `db/disposable-pg/*.pgtest.ts`, which needs a
// disposable database and is not part of `npm test`/CI (see README,
// «Отложено»). Here the use-case contract and the CAS shape are checked; row
// locks and isolation levels are not.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Phase = "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;

type Row = {
  id: string;
  status: "OPEN" | "RESERVED" | "CLOSED";
  archivedAt: Date | null;
  reservationPhase: Phase;
  reservationPhaseAt: Date | null;
  reservationDueAt: Date | null;
  reservationTimeZone: string | null;
  reservationBought: boolean;
  reservedById: string | null;
  reservedAt: Date | null;
  titleSnapshotOnReserve: string | null;
  holderVisibleToOwner: boolean;
  holderVisibleToOthers: boolean;
};

type WriteAttempt = {
  id: string;
  matched: number;
  data: Record<string, unknown>;
};

/**
 * The fake evaluates only what the production call actually asks for: an
 * equality, `in`, `lte`, `gt` or `not`. Every condition in `where` must hold.
 */
function conditionMatches(value: unknown, condition: unknown): boolean {
  if (condition === null || condition instanceof Date || typeof condition !== "object") {
    return value === condition;
  }
  const cmp = condition as {
    in?: readonly unknown[];
    equals?: unknown;
    lte?: Date;
    lt?: Date;
    gt?: string | Date;
    not?: unknown;
  };
  if (cmp.in !== undefined && !cmp.in.includes(value)) return false;
  if (cmp.equals !== undefined && value !== cmp.equals) return false;
  if (cmp.lte !== undefined) {
    if (!(value instanceof Date) || value.getTime() > cmp.lte.getTime()) return false;
  }
  if (cmp.lt !== undefined) {
    if (!(value instanceof Date) || value.getTime() >= cmp.lt.getTime()) return false;
  }
  if (cmp.gt !== undefined) {
    if (value instanceof Date && cmp.gt instanceof Date) {
      if (value.getTime() <= cmp.gt.getTime()) return false;
    } else if (String(value) <= String(cmp.gt)) {
      return false;
    }
  }
  if (cmp.not !== undefined && value === cmp.not) return false;
  return true;
}

const { state, timerClient } = vi.hoisted(() => {
  const state = {
    rows: [] as Row[],
    /** The three candidate reads of a run, in call order. */
    candidateReads: [] as { phase: unknown; ids: string[] }[],
    /** Every CAS attempt: which row it targeted and how many rows it matched. */
    writes: [] as WriteAttempt[],
    transactions: 0,
    /** Fires once at the start of the next transaction, before the CAS. */
    beforeTransaction: null as (() => void) | null,
  };

  function rowMatches(row: Row, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(function keyMatches([key, condition]) {
      return conditionMatches((row as unknown as Record<string, unknown>)[key], condition);
    });
  }

  async function findMany(args: {
    where?: Record<string, unknown>;
    take?: number;
  }): Promise<{ id: string }[]> {
    const where = args.where ?? {};
    const rows = state.rows
      .filter((row) => rowMatches(row, where))
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .slice(0, args.take ?? state.rows.length);
    state.candidateReads.push({ phase: where.reservationPhase, ids: rows.map((row) => row.id) });
    return rows.map((row) => ({ id: row.id }));
  }

  async function updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }> {
    // --- no `await` between the check and the write: one uninterrupted step ---
    const rows = state.rows.filter((row) => rowMatches(row, args.where));
    for (const row of rows) Object.assign(row, args.data as Partial<Row>);
    state.writes.push({ id: String(args.where.id), matched: rows.length, data: args.data });
    return { count: rows.length };
  }

  async function findUnique(args: {
    where: { id: string };
  }): Promise<Row | null> {
    return state.rows.find((candidate) => candidate.id === args.where.id) ?? null;
  }

  async function transaction(work: (tx: unknown) => Promise<unknown>): Promise<unknown> {
    state.transactions += 1;
    const before = state.beforeTransaction;
    state.beforeTransaction = null;
    before?.();
    return work({ gift: { findMany, updateMany, findUnique } });
  }

  return {
    state,
    timerClient: {
      gift: { findMany, updateMany, findUnique },
      $transaction: transaction,
    },
  };
});

vi.mock("@/db/client", () => ({ prisma: timerClient }));

import type { PrismaClient } from "@/db/generated/client";
import { processReservationTimers } from "@/lib/gift-status-store";

const db = timerClient as unknown as Pick<PrismaClient, "gift" | "$transaction">;

const NOW = new Date("2026-11-22T12:00:00.000Z");
const OWNER_WINDOW_MS = 168 * 60 * 60 * 1000;
/** The exact moment 168 hours before `NOW`: a deadline at it is already due. */
const OWNER_DEADLINE = new Date(NOW.getTime() - OWNER_WINDOW_MS);
/** One minute before the deadline window: a live row would be released. */
const PAST_OWNER_WINDOW = new Date(NOW.getTime() - OWNER_WINDOW_MS - 60_000);

const ZEROS = { expiredToGiver: 0, toAwaitingOwner: 0, released: 0, failed: 0 };

/** A timer row of `holder` whose deadline is older than 168 hours. */
function timerRow(overrides: Partial<Row> & { id: string }): Row {
  return {
    status: "RESERVED",
    archivedAt: null,
    reservationPhase: "AWAITING_OWNER",
    reservationPhaseAt: PAST_OWNER_WINDOW,
    reservationDueAt: new Date("2026-11-15T00:00:00.000Z"),
    reservationTimeZone: "UTC",
    reservationBought: false,
    reservedById: "holder",
    reservedAt: new Date("2026-11-01T00:00:00.000Z"),
    titleSnapshotOnReserve: "Плед",
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    ...overrides,
    id: overrides.id,
  };
}

beforeEach(() => {
  state.rows = [];
  state.candidateReads = [];
  state.writes = [];
  state.transactions = 0;
  state.beforeTransaction = null;
});

describe("AD-15 (6) — cron не открывает bought и GIVEN", () => {
  it("не трогает бронь с bought=true, даже когда 168 часов прошли", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.rows = [timerRow({ id: "g-bought", reservationBought: true })];
    const before = state.rows.map((row) => ({ ...row }));

    await expect(processReservationTimers(NOW, db)).resolves.toEqual(ZEROS);

    // The row was never even a candidate of step 3 and no CAS was attempted.
    expect(state.candidateReads.map((read) => read.phase)).toEqual([
      "ACTIVE",
      "AWAITING_GIVER",
      "AWAITING_OWNER",
    ]);
    expect(state.candidateReads[2]?.ids).toEqual([]);
    expect(state.writes).toEqual([]);

    // Neither the status nor a single reservation column moved, and the run
    // wrote no audit line.
    expect(state.rows).toEqual(before);
    expect(state.rows[0]).toMatchObject({
      status: "RESERVED",
      reservationPhase: "AWAITING_OWNER",
      reservationBought: true,
      reservedById: "holder",
    });
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });

  it("не трогает бронь в фазе GIVEN, даже когда 168 часов прошли", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.rows = [timerRow({ id: "g-given", reservationPhase: "GIVEN" })];
    const before = state.rows.map((row) => ({ ...row }));

    await expect(processReservationTimers(NOW, db)).resolves.toEqual(ZEROS);

    expect(state.candidateReads[2]?.ids).toEqual([]);
    expect(state.writes).toEqual([]);
    expect(state.rows).toEqual(before);
    expect(state.rows[0]).toMatchObject({
      status: "RESERVED",
      reservationPhase: "GIVEN",
      reservedById: "holder",
    });
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });
});

describe("AD-15 (6) — окно снятия считается от срока брони, а не от начала фазы (CLE-124/D-49)", () => {
  it("снимает ровно через 168 часов после срока и не снимает за одну миллисекунду до этого", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.rows = [
      timerRow({ id: "g-edge", reservationDueAt: OWNER_DEADLINE }),
      timerRow({ id: "g-inside", reservationDueAt: new Date(OWNER_DEADLINE.getTime() + 1) }),
    ];

    await expect(processReservationTimers(NOW, db)).resolves.toEqual({
      ...ZEROS,
      released: 1,
    });

    expect(state.rows.find((row) => row.id === "g-edge")).toMatchObject({
      status: "OPEN",
      reservationPhase: null,
      reservedById: null,
    });
    expect(state.rows.find((row) => row.id === "g-inside")).toMatchObject({
      status: "RESERVED",
      reservationPhase: "AWAITING_OWNER",
      reservedById: "holder",
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });

  it("снимает бронь, если срок старше 168 часов, даже когда фаза началась недавно", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    state.rows = [
      timerRow({
        id: "g-late-phase",
        reservationDueAt: new Date(NOW.getTime() - 200 * 60 * 60 * 1000),
        reservationPhaseAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      }),
    ];

    await expect(processReservationTimers(NOW, db)).resolves.toEqual({
      ...ZEROS,
      released: 1,
    });

    expect(state.rows[0]).toMatchObject({ status: "OPEN", reservationPhase: null });
    info.mockRestore();
  });

  it("не снимает строку, которую шаг 2 перевёл в AWAITING_OWNER в этом же запуске", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const giverDeadline = new Date(NOW.getTime() - 72 * 60 * 60 * 1000);
    state.rows = [
      timerRow({
        id: "g-step2",
        reservationPhase: "AWAITING_GIVER",
        reservationPhaseAt: giverDeadline,
        reservationDueAt: new Date(NOW.getTime() - 200 * 60 * 60 * 1000),
      }),
    ];

    await expect(processReservationTimers(NOW, db)).resolves.toEqual({
      ...ZEROS,
      toAwaitingOwner: 1,
    });
    expect(state.rows[0]).toMatchObject({
      status: "RESERVED",
      reservationPhase: "AWAITING_OWNER",
      reservationPhaseAt: NOW,
      reservedById: "holder",
    });

    // The same `now` cannot pass `phaseAt < now`, so a repeated run still waits.
    await expect(processReservationTimers(NOW, db)).resolves.toEqual(ZEROS);

    // One hour later the phase is in the past and the old deadline releases it.
    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    await expect(processReservationTimers(later, db)).resolves.toEqual({
      ...ZEROS,
      released: 1,
    });
    expect(state.rows[0]).toMatchObject({ status: "OPEN", reservationPhase: null });
    info.mockRestore();
  });

  it("оставляет бронь живой, когда держатель продлил её между выборкой и CAS", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const extendedDueAt = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
    state.rows = [timerRow({ id: "g-extend" })];

    state.beforeTransaction = function holderExtendsFirst() {
      const target = state.rows.find((row) => row.id === "g-extend");
      if (target === undefined) throw new Error("expected the timer candidate");
      target.reservationPhase = "ACTIVE";
      target.reservationDueAt = extendedDueAt;
      target.reservationPhaseAt = NOW;
    };

    await expect(processReservationTimers(NOW, db)).resolves.toEqual(ZEROS);

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({ id: "g-extend", matched: 0 });
    expect(state.rows[0]).toMatchObject({
      status: "RESERVED",
      reservationPhase: "ACTIVE",
      reservationDueAt: extendedDueAt,
      reservedById: "holder",
      titleSnapshotOnReserve: "Плед",
    });
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});

describe("AD-15 (7) — гонка cron и пользователя", () => {
  it("не переписывает строку, которую держатель изменил между выборкой и CAS", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.rows = [timerRow({ id: "g-race" })];

    // The holder presses «Купил» after the cron read the candidate but before
    // its CAS transaction; the same fake applies the production CAS predicate.
    state.beforeTransaction = function holderBuysFirst() {
      const target = state.rows.find((row) => row.id === "g-race");
      if (target === undefined) throw new Error("expected the timer candidate");
      target.reservationBought = true;
    };

    await expect(processReservationTimers(NOW, db)).resolves.toEqual(ZEROS);

    // The CAS ran exactly once and matched no row: the transition was lost,
    // nothing was cleared and no audit line was written.
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({ id: "g-race", matched: 0 });
    expect(state.rows[0]).toMatchObject({
      status: "RESERVED",
      reservationPhase: "AWAITING_OWNER",
      reservationPhaseAt: PAST_OWNER_WINDOW,
      reservationBought: true,
      reservedById: "holder",
      titleSnapshotOnReserve: "Плед",
    });
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });

  it("повторный прогон с тем же now не даёт второго перехода", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    state.rows = [timerRow({ id: "g-race" })];
    state.beforeTransaction = function holderBuysFirst() {
      const target = state.rows.find((row) => row.id === "g-race");
      if (target === undefined) throw new Error("expected the timer candidate");
      target.reservationBought = true;
    };

    await expect(processReservationTimers(NOW, db)).resolves.toEqual(ZEROS);
    const writesAfterFirstRun = state.writes.length;

    // The user's state is what the row keeps; the second run does not select it
    // as a candidate anymore, so it does not even try a CAS.
    await expect(processReservationTimers(NOW, db)).resolves.toEqual(ZEROS);

    expect(state.writes).toHaveLength(writesAfterFirstRun);
    expect(state.rows[0]).toMatchObject({
      status: "RESERVED",
      reservationPhase: "AWAITING_OWNER",
      reservationBought: true,
      reservedById: "holder",
    });
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
