// AD-15 (1): two simultaneous reservations of one SINGLE wish — exactly one wins.
// The use-case `reserveGift` is the shared gate of both adapters (AD-1), so the
// race is checked there, not only in the store. The fake store below mirrors the
// Prisma adapter's atomic CAS (`updateMany ... where status: "OPEN", quantity:
// "SINGLE"`): the check and the write are one uninterrupted step, so of two
// writers exactly one still sees `OPEN` and the other finds the row moved.
//
// This is not the real PostgreSQL race: the two-transaction proof lives in
// `db/disposable-pg/reserve.pgtest.ts`, runs on a disposable database and is not
// part of `npm test`/CI (see README, «Отложено»). Here the use-case contract and
// the CAS shape are checked; row locks and isolation levels are not.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  findFirstRow,
  findUser,
  transaction,
  relationsBetween,
  store,
  GIFT_ID,
  resetStore,
  reserveInCas,
} = vi.hoisted(() => {
  const GIFT_ID = "g1";
  const OWNER_ID = "owner";
  const LIST_TOKEN = "tok-1";
  const RACERS = 2;

  const people: Record<string, { id: string; nick: string; name: string }> = {
    donor: { id: "donor", nick: "daria", name: "Дарья" },
    rival: { id: "rival", nick: "roman", name: "Роман" },
  };

  type StoredRow = {
    id: string;
    title: string;
    description: null;
    priceAmount: null;
    priceCurrency: null;
    linkUrl: null;
    visibility: "PUBLIC";
    quantity: "SINGLE";
    expiresOn: null;
    archivedAt: null;
    closedAt: null;
    status: "OPEN" | "RESERVED";
    reservationPhase: "ACTIVE" | null;
    reservationDueAt: Date | null;
    reservationTimeZone: string | null;
    reservationBought: boolean;
    holderVisibleToOwner: boolean;
    holderVisibleToOthers: boolean;
    reservedById: string | null;
    reservedAt: Date | null;
    titleSnapshotOnReserve: string | null;
  };

  const store = {
    row: null as StoredRow | null,
    /** Statuses seen by each read, in call order; the first two are the pre-checks. */
    reads: [] as string[],
    /** Every CAS attempt, in the order the atomic sections ran. */
    writes: [] as { actorId: string; outcome: "success" | "lost" }[],
    arrivals: 0,
    openGate: null as (() => void) | null,
    gate: Promise.resolve(),
  };

  /**
   * The atomic section of the fake CAS. Both callers hold until each has
   * arrived, which models two transactions that have already passed their
   * `findFirst`; the check-and-write that follows has no `await`.
   */
  async function reserveInCas(giftId: string, write: ReserveGiftWrite) {
    store.arrivals += 1;
    if (store.arrivals === RACERS) store.openGate?.();
    await store.gate;

    const row = store.row;
    const eligible =
      row !== null &&
      row.id === giftId &&
      row.status === "OPEN" &&
      row.quantity === "SINGLE" &&
      row.archivedAt === null;

    // --- no `await` between the check and the write: one uninterrupted step ---
    if (eligible) {
      row.status = "RESERVED";
      row.reservedById = write.reservedById;
      row.reservedAt = write.reservedAt;
      row.titleSnapshotOnReserve = write.titleSnapshotOnReserve;
      row.reservationDueAt = write.reservationDueAt;
      row.reservationTimeZone = write.reservationTimeZone;
      row.reservationPhase = "ACTIVE";
      row.reservationBought = false;
      row.holderVisibleToOwner = write.holderVisibleToOwner;
      row.holderVisibleToOthers = write.holderVisibleToOthers;
    }
    store.writes.push({
      actorId: write.reservedById,
      outcome: eligible ? "success" : "lost",
    });
    return eligible ? "success" : "lost";
  }

  const getSession = vi.fn(async function session(args: { headers: Headers }) {
    const actor = args.headers.get("x-actor");
    return actor === null ? null : { user: { id: actor } };
  });

  const findFirstRow = vi.fn(async function readRow() {
    const row = store.row;
    if (row === null) return null;
    store.reads.push(row.status);
    const holder = row.reservedById === null ? null : (people[row.reservedById] ?? null);
    return {
      ...row,
      reservedBy: holder,
      tags: [],
      list: { ownerId: OWNER_ID, publicToken: LIST_TOKEN },
    };
  });

  const findUser = vi.fn(async function readUser() {
    return { timeZone: "UTC" };
  });

  const transaction = vi.fn(async function runTransaction(work: (tx: object) => Promise<unknown>) {
    return work({});
  });

  const relationsBetween = vi.fn(async function relations() {
    return { blocked: false, friend: true, subscriber: false, contactMatch: false };
  });

  function resetStore() {
    store.row = {
      id: GIFT_ID,
      title: "Плед",
      description: null,
      priceAmount: null,
      priceCurrency: null,
      linkUrl: null,
      visibility: "PUBLIC",
      quantity: "SINGLE",
      expiresOn: null,
      archivedAt: null,
      closedAt: null,
      status: "OPEN",
      reservationPhase: null,
      reservationDueAt: null,
      reservationTimeZone: null,
      reservationBought: false,
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
      reservedById: null,
      reservedAt: null,
      titleSnapshotOnReserve: null,
    };
    store.reads = [];
    store.writes = [];
    store.arrivals = 0;
    store.gate = new Promise<void>(function holdUntilBothArrive(resolve) {
      store.openGate = resolve;
    });
  }

  return {
    getSession,
    findFirstRow,
    findUser,
    transaction,
    relationsBetween,
    store,
    GIFT_ID,
    resetStore,
    reserveInCas,
  };
});

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    gift: { findFirst: findFirstRow },
    user: { findUnique: findUser },
    $transaction: transaction,
  },
}));
vi.mock("@/lib/relationships", () => ({ relationshipReader: { relationsBetween } }));
vi.mock("@/lib/gift-status-store", () => ({
  giftStatusTransaction: () => ({ reserveGift: reserveInCas }),
}));

import { giftCardSchema } from "@gift-list/contracts";
import { addCalendarDays, calendarDayInZone } from "@/domain/reservation-due";
import type { ReserveGiftWrite } from "@/domain/gift-status";
import { reserveGift as reserveGiftAction } from "@/actions/gift-reserve";

// Seven days ahead in UTC: inside the `[today, today+30]` window the use-case accepts.
const dueOn = addCalendarDays(calendarDayInZone(new Date(), "UTC"), 7);

function headersFor(actor: string): Headers {
  return new Headers({ "x-actor": actor, "accept-language": "ru-RU,ru;q=0.9" });
}

/** The two bodies differ in `holderVisibleToOthers`, so the row proves who wrote. */
function bodyFor(holderVisibleToOthers: boolean) {
  return { dueOn, holderVisibleToOwner: false, holderVisibleToOthers };
}

/** One shared OPEN/SINGLE wish; both racers pass their pre-check before any CAS. */
function race() {
  return Promise.all([
    reserveGiftAction(headersFor("donor"), GIFT_ID, bodyFor(true)),
    reserveGiftAction(headersFor("rival"), GIFT_ID, bodyFor(false)),
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe("AD-15 (1) — две одновременные брони SINGLE", () => {
  it("ровно один из двух вызовов reserveGift получает бронь", async () => {
    const [donor, rival] = await race();

    const winners = [donor, rival].filter((result) => result.ok);
    expect(winners).toHaveLength(1);

    const loser = [donor, rival].find((result) => !result.ok);
    if (loser === undefined || loser.ok) throw new Error("expected exactly one loser");
    expect(loser).toMatchObject({
      ok: false,
      code: "CONFLICT",
      reason: "RESERVATION_TAKEN",
    });

    // Both use-cases read the same `OPEN` row and both reached the CAS: this is
    // a race, not one call finishing before the other started.
    expect(store.reads.slice(0, 2)).toEqual(["OPEN", "OPEN"]);
    expect(store.writes).toHaveLength(2);
    expect(store.writes.filter((write) => write.outcome === "success")).toHaveLength(1);
  });

  it("оставляет в строке одного держателя, проигравший ничего не пишет", async () => {
    const [donor, rival] = await race();

    const winner = donor.ok ? donor : rival;
    if (!winner.ok) throw new Error("expected exactly one winner");
    const winnerId = winner.data.reservedBy?.id;
    expect(winnerId).toBe(donor.ok ? "donor" : "rival");

    // The row carries the winner and only the winner: its own visibility choice
    // is the one that survived, and a single CAS attempt succeeded.
    expect(store.row?.reservedById).toBe(winnerId);
    expect(store.row?.holderVisibleToOthers).toBe(winnerId === "donor");
    expect(store.writes.filter((write) => write.outcome === "success")).toEqual([
      { actorId: winnerId, outcome: "success" },
    ]);
    expect(store.writes.filter((write) => write.outcome === "lost")).toHaveLength(1);
  });

  it("карточка победителя проходит giftCardSchema и показывает его бронь", async () => {
    const [donor, rival] = await race();

    const winner = donor.ok ? donor : rival;
    if (!winner.ok) throw new Error("expected exactly one winner");

    expect(giftCardSchema.safeParse(winner.data).success).toBe(true);
    expect(winner.data.status).toBe("RESERVED");
    expect(winner.data.reservedBy?.id).toBe(store.row?.reservedById);
    expect(winner.data.reservation).toMatchObject({
      phase: "ACTIVE",
      bought: false,
      holderVisibleToOwner: false,
    });
  });
});
