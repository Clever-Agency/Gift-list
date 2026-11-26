// AD-15 (5) / D-49 (CLE-124): the owner cannot tell a reserved wish from an open
// one. Every owner-facing answer is compared for the same wish in two states:
// open, and reserved by somebody else (any phase, `bought` yes or no). The
// comparison is on the whole envelope — status, `ok`, the error code and the body
// — with only the wall-clock moment (`undoUntil`) normalized.
//
// The suite runs the real use-cases against one in-memory row: the same code
// paths the `api/v1` adapters and the app screens call (AD-1). A break is either
// a leaked reservation fact or a different answer born of the reservation.
import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Status = "OPEN" | "RESERVED" | "CLOSED";
type Phase = "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN";
type Visibility = "PUBLIC" | "FRIENDS" | "SECRET";
type TagRow = { tagId: string | null; customText: string | null; tag: null };

type Row = {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: "BYN" | "RUB" | null;
  linkUrl: string | null;
  visibility: Visibility;
  quantity: "SINGLE" | "UNLIMITED";
  expiresOn: Date | null;
  archivedAt: Date | null;
  closedAt: Date | null;
  closedFromStatus: "OPEN" | "RESERVED" | null;
  createdAt: Date;
  updatedAt: Date;
  status: Status;
  reservedById: string | null;
  reservedAt: Date | null;
  reservationDueAt: Date | null;
  reservationTimeZone: string | null;
  reservationPhase: Phase | null;
  reservationPhaseAt: Date | null;
  reservationBought: boolean;
  holderVisibleToOwner: boolean;
  holderVisibleToOthers: boolean;
  titleSnapshotOnReserve: string | null;
  reservedBy: { id: string; nick: string; name: string } | null;
  tags: TagRow[];
  list: {
    ownerId: string;
    publicToken: string;
    owner: { name: string; nick: string; timeZone: string };
  };
};

type List = { id: string; ownerId: string; publicToken: string; owner: { name: string; nick: string } };
type UserRow = {
  id: string;
  name: string;
  nick: string;
  nickNormalized: string;
  timeZone: string;
  birthDay: number | null;
  birthMonth: number | null;
  gender: "MALE" | "FEMALE" | null;
  country: string | null;
  about: string | null;
  profileVisibleToFriends: boolean;
};
type Where = Record<string, unknown>;
type Args = { where?: Where; data?: Record<string, unknown> | Record<string, unknown>[] };

const {
  OWNER,
  HOLDER,
  LIST,
  state,
  fakePrisma,
  getSession,
  relationsBetween,
  profileReads,
  PrismaClientKnownRequestError,
} = vi.hoisted(function store() {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, { code }: { code: string }) {
      super(message);
      this.code = code;
    }
  }

  const OWNER = "owner";
  const HOLDER = "holder";
  const LIST: List = {
    id: "l1",
    ownerId: OWNER,
    publicToken: "tok-owner",
    owner: { name: "Анна", nick: "anna" },
  };
  const USER: UserRow = {
    id: OWNER,
    name: "Анна",
    nick: "anna",
    nickNormalized: "anna",
    timeZone: "UTC",
    // CLE-129/T8.2: `/u/:nick` reads the profile fields with the owner row.
    birthDay: null,
    birthMonth: null,
    gender: null,
    country: null,
    about: null,
    profileVisibleToFriends: true,
  };

  const state = {
    actor: OWNER as string | null,
    row: null as Row | null,
    notifications: [] as unknown[],
    relations: { blocked: false, friend: false, subscriber: false, contactMatch: false },
  };

  function momentMatches(value: Date | null, expected: unknown): boolean {
    if (expected === undefined) return true;
    if (expected === null) return value === null;
    if (expected instanceof Date) return value?.getTime() === expected.getTime();
    if (typeof expected === "object") {
      const filter = expected as { equals?: Date; gt?: Date };
      if (filter.equals !== undefined && value?.getTime() !== filter.equals.getTime()) return false;
      if (filter.gt !== undefined && !(value !== null && value.getTime() > filter.gt.getTime())) {
        return false;
      }
    }
    return true;
  }

  function statusMatches(row: Row, expected: unknown): boolean {
    if (typeof expected === "string") return row.status === expected;
    if (expected === null || typeof expected !== "object") return true;
    const filter = expected as { not?: Status; in?: Status[] };
    if (filter.not !== undefined && row.status === filter.not) return false;
    if (filter.in !== undefined && !filter.in.includes(row.status)) return false;
    return true;
  }

  /** Prisma's `{ not: null }`: the column must be set. */
  function notNullMatches(value: unknown, expected: unknown): boolean {
    if (expected === undefined || expected === null || typeof expected !== "object") return true;
    return (expected as { not?: null }).not === null ? value !== null : true;
  }

  function matches(row: Row, where: Where = {}): boolean {
    if (typeof where.id === "string" && row.id !== where.id) return false;
    if (typeof where.listId === "string" && row.listId !== where.listId) return false;
    if (where.archivedAt === null && row.archivedAt !== null) return false;
    const not = where.NOT as { archivedAt?: null } | undefined;
    if (not?.archivedAt === null && row.archivedAt === null) return false;
    const list = where.list as { ownerId?: string } | undefined;
    if (list?.ownerId !== undefined && row.list.ownerId !== list.ownerId) return false;
    if (where.status !== undefined && !statusMatches(row, where.status)) return false;
    if (where.visibility !== undefined) {
      const filter = where.visibility as { in?: Visibility[] };
      if (filter.in !== undefined && !filter.in.includes(row.visibility)) return false;
    }
    if (typeof where.quantity === "string" && row.quantity !== where.quantity) return false;
    if (where.reservedById !== undefined && row.reservedById !== where.reservedById) return false;
    if (where.closedFromStatus !== undefined && row.closedFromStatus !== where.closedFromStatus) {
      return false;
    }
    if (!momentMatches(row.updatedAt, where.updatedAt)) return false;
    if (!momentMatches(row.closedAt, where.closedAt)) return false;
    if (!notNullMatches(row.reservationDueAt, where.reservationDueAt)) return false;
    if (!notNullMatches(row.reservationPhase, where.reservationPhase)) return false;
    return true;
  }

  function applyData(row: Row, data: Record<string, unknown>) {
    Object.assign(row, data);
    row.updatedAt = new Date(row.updatedAt.getTime() + 1);
  }

  const gift = {
    async findUnique({ where }: Args) {
      const row = state.row;
      return row !== null && matches(row, where) ? { ...row } : null;
    },
    async findFirst({ where }: Args) {
      const row = state.row;
      return row !== null && matches(row, where) ? { ...row } : null;
    },
    async findMany({ where }: Args) {
      const row = state.row;
      return row !== null && matches(row, where) ? [{ ...row }] : [];
    },
    async count({ where }: Args) {
      const row = state.row;
      return row !== null && matches(row, where) ? 1 : 0;
    },
    async update({ where, data }: Args) {
      const row = state.row;
      if (row === null || !matches(row, where)) {
        throw new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" });
      }
      applyData(row, data as Record<string, unknown>);
      return { id: row.id };
    },
    async updateMany({ where, data }: Args) {
      const row = state.row;
      if (row === null || !matches(row, where)) return { count: 0 };
      applyData(row, data as Record<string, unknown>);
      return { count: 1 };
    },
    async deleteMany({ where }: Args) {
      const row = state.row;
      if (row === null || !matches(row, where)) return { count: 0 };
      state.row = null;
      return { count: 1 };
    },
  };

  const notification = {
    async createMany({ data }: Args) {
      const rows = Array.isArray(data) ? data : [data];
      state.notifications.push(...rows);
      return { count: rows.length };
    },
    async deleteMany() {
      return { count: 0 };
    },
  };

  async function queryRaw(strings: TemplateStringsArray) {
    if (strings.join(" ").includes("clock_timestamp")) return [{ now: new Date() }];
    const row = state.row;
    return row === null ? [] : [{ status: row.status, closedAt: row.closedAt }];
  }

  const delegates = {
    gift,
    notification,
    tag: { async findMany() { return []; } },
    giftTag: {
      async deleteMany() { return { count: 0 }; },
      async createMany() { return { count: 0 }; },
    },
    user: {
      async findUnique({ where }: Args) {
        const filters = (where ?? {}) as { id?: string; nickNormalized?: string };
        if (filters.id !== undefined) return filters.id === USER.id ? { ...USER } : null;
        if (filters.nickNormalized !== undefined) {
          return filters.nickNormalized === USER.nickNormalized ? { ...USER } : null;
        }
        return null;
      },
    },
    list: {
      async findUnique({ where }: Args) {
        const filters = (where ?? {}) as { ownerId?: string; publicToken?: string };
        if (filters.ownerId !== undefined) return filters.ownerId === LIST.ownerId ? LIST : null;
        if (filters.publicToken !== undefined) {
          return filters.publicToken === LIST.publicToken ? LIST : null;
        }
        return null;
      },
    },
  };

  const fakePrisma = Object.assign(delegates, {
    async $transaction(work: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) {
      if (typeof work === "function") return work({ ...delegates, $queryRaw: queryRaw });
      return Promise.all(work);
    },
    $queryRaw: queryRaw,
  });

  return {
    OWNER,
    HOLDER,
    LIST,
    state,
    fakePrisma,
    getSession: vi.fn(),
    relationsBetween: vi.fn(),
    profileReads: {
      relationship: vi.fn(),
      cooldown: vi.fn(),
      subscription: vi.fn(),
    },
    PrismaClientKnownRequestError,
  };
});

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: fakePrisma }));
vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError } }));
vi.mock("@/lib/relationships", async function relationships(importOriginal) {
  const actual = await importOriginal<typeof import("@/lib/relationships")>();
  return {
    ...actual,
    relationshipReader: { ...actual.relationshipReader, relationsBetween },
    readProfileRelationship: profileReads.relationship,
    readProfileInviteCooldown: profileReads.cooldown,
    readProfileSubscription: profileReads.subscription,
  };
});

import { closeGift, undoGiftClose } from "@/actions/gift-close";
import { reserveGift } from "@/actions/gift-reserve";
import { deleteGift, getGift, previewGiftVisibility, updateGift } from "@/actions/gifts";
import { getMyGifts } from "@/actions/my-gifts";
import { getMyReservations } from "@/actions/my-reservations";
import { getProfileByNick } from "@/actions/profile";
import { restoreGift } from "@/actions/restore-gift";

const HEADERS = new Headers({ "accept-language": "ru-RU,ru;q=0.9" });

function baseRow(status: Status, overrides: Partial<Row> = {}): Row {
  return {
    id: "g1",
    listId: LIST.id,
    title: "Плед",
    description: "Мягкий",
    priceAmount: 10000,
    priceCurrency: "BYN",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    closedAt: null,
    closedFromStatus: null,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    status,
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
    reservedBy: null,
    tags: [],
    list: {
      ownerId: OWNER,
      publicToken: LIST.publicToken,
      owner: { name: "Анна", nick: "anna", timeZone: "UTC" },
    },
    ...overrides,
  };
}

/** The reserved twin of the same wish: a live reservation in the given phase. */
function reservedRow(phase: Phase = "ACTIVE", bought = false, overrides: Partial<Row> = {}): Row {
  return baseRow("RESERVED", {
    reservedById: HOLDER,
    reservedAt: new Date("2026-11-02T00:00:00.000Z"),
    reservationDueAt: new Date("2026-12-01T00:00:00.000Z"),
    reservationTimeZone: "UTC",
    reservationPhase: phase,
    reservationPhaseAt: new Date("2026-11-02T00:00:00.000Z"),
    reservationBought: bought,
    titleSnapshotOnReserve: "Плед",
    reservedBy: { id: HOLDER, nick: "daria", name: "Дарья" },
    ...overrides,
  });
}

/** One fresh store: the row, no notifications, no relations, the owner acting. */
function reset(row: Row) {
  state.row = row;
  state.notifications = [];
  state.relations = { blocked: false, friend: false, subscriber: false, contactMatch: false };
  state.actor = OWNER;
}

/** The owner's answer with the wall-clock moment removed; ids are stable here. */
function ownerAnswer(answer: unknown): unknown {
  return JSON.parse(
    JSON.stringify(answer, function normalize(key, value: unknown) {
      if (key === "undoUntil") return "<moment>";
      return value;
    }),
  );
}

/**
 * One owner-facing call is run twice: on the open wish and on the reserved twin
 * of the same wish. The pair must be byte-identical after normalization.
 */
async function expectSameAnswer(
  open: () => Promise<unknown>,
  reserved: () => Promise<unknown>,
): Promise<{ open: unknown; reserved: unknown }> {
  const openAnswer = await open();
  const reservedAnswer = await reserved();
  // Every scenario below is a successful owner answer: equal failures would hide
  // a broken fake behind a trivially identical error.
  for (const answer of Array.isArray(openAnswer) ? openAnswer : [openAnswer]) {
    expect(answer).toMatchObject({ ok: true });
  }
  expect(ownerAnswer(reservedAnswer)).toEqual(ownerAnswer(openAnswer));
  return { open: openAnswer, reserved: reservedAnswer };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(function quiet() {});
  getSession.mockImplementation(async function session() {
    return state.actor === null ? null : { user: { id: state.actor }, session: { token: "t" } };
  });
  relationsBetween.mockImplementation(async function relations() {
    return { ...state.relations };
  });
  profileReads.relationship.mockResolvedValue("NONE");
  profileReads.cooldown.mockResolvedValue(null);
  profileReads.subscription.mockResolvedValue(false);
  reset(baseRow("OPEN"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AD-15 (5) — владелец не отличает забронированное желание от открытого", () => {
  it("одинаково отвечает на список, одну карточку и свой профиль", async () => {
    await expectSameAnswer(
      async function openAnswers() {
        reset(baseRow("OPEN"));
        return [
          await getMyGifts(HEADERS),
          await getGift(HEADERS, "g1"),
          await getProfileByNick("anna", HEADERS),
        ];
      },
      async function reservedAnswers() {
        reset(reservedRow("ACTIVE", false));
        return [
          await getMyGifts(HEADERS),
          await getGift(HEADERS, "g1"),
          await getProfileByNick("anna", HEADERS),
        ];
      },
    );

    // The comparison is only meaningful when the reserved side really has a
    // holder and a purchase mark the plain card would have shown before D-49.
    reset(reservedRow("ACTIVE", true));
    expect(state.row).toMatchObject({
      status: "RESERVED",
      reservedById: HOLDER,
      reservationBought: true,
    });
  });

  it.each([
    ["ACTIVE", false],
    ["AWAITING_GIVER", true],
    ["AWAITING_OWNER", true],
    ["AWAITING_OWNER", false],
    ["GIVEN", false],
  ] as const)("читает бронь в фазе %s (bought: %s) как открытое желание", async (phase, bought) => {
    await expectSameAnswer(
      async function openAnswers() {
        reset(baseRow("OPEN"));
        return [await getMyGifts(HEADERS), await getGift(HEADERS, "g1")];
      },
      async function reservedAnswers() {
        reset(reservedRow(phase, bought));
        return [await getMyGifts(HEADERS), await getGift(HEADERS, "g1")];
      },
    );
  });

  it("одинаково правит название", async () => {
    await expectSameAnswer(
      async function openEdit() {
        reset(baseRow("OPEN"));
        return updateGift(HEADERS, "g1", { title: "Новое название" });
      },
      async function reservedEdit() {
        reset(reservedRow());
        return updateGift(HEADERS, "g1", { title: "Новое название" });
      },
    );
  });

  it("одинаково меняет quantity SINGLE → UNLIMITED и оставляет бронь держателю", async () => {
    const { reserved } = await expectSameAnswer(
      async function openEdit() {
        reset(baseRow("OPEN"));
        return updateGift(HEADERS, "g1", { quantity: "UNLIMITED" });
      },
      async function reservedEdit() {
        reset(reservedRow());
        return updateGift(HEADERS, "g1", { quantity: "UNLIMITED" });
      },
    );

    expect(reserved).toMatchObject({ ok: true, data: { quantity: "UNLIMITED" } });
    // The reservation did not move and the holder got no new line.
    expect(state.row).toMatchObject({
      status: "RESERVED",
      reservedById: HOLDER,
      quantity: "UNLIMITED",
    });
    expect(state.notifications).toHaveLength(0);

    // The holder still sees the booking in «Мои брони».
    state.actor = HOLDER;
    const mine = await getMyReservations(HEADERS);
    expect(mine).toMatchObject({ ok: true });
    if (mine.ok) expect(mine.data.reservations).toHaveLength(1);

    // A new reservation of an UNLIMITED wish is still refused.
    state.actor = "guest";
    expect(await reserveGift(HEADERS, "g1", { dueOn: "2099-01-01" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
  });

  it("одинаково меняет quantity UNLIMITED → SINGLE", async () => {
    await expectSameAnswer(
      async function openEdit() {
        reset(baseRow("OPEN", { quantity: "UNLIMITED" }));
        return updateGift(HEADERS, "g1", { quantity: "SINGLE" });
      },
      async function reservedEdit() {
        reset(reservedRow("ACTIVE", false, { quantity: "UNLIMITED" }));
        return updateGift(HEADERS, "g1", { quantity: "SINGLE" });
      },
    );
    expect(state.row).toMatchObject({ status: "RESERVED" });
  });

  it("одинаково расширяет видимость", async () => {
    await expectSameAnswer(
      async function openEdit() {
        reset(baseRow("OPEN", { visibility: "PUBLIC" }));
        return updateGift(HEADERS, "g1", { visibility: "FRIENDS" });
      },
      async function reservedEdit() {
        reset(reservedRow("ACTIVE", false, { visibility: "PUBLIC" }));
        return updateGift(HEADERS, "g1", { visibility: "FRIENDS" });
      },
    );
  });

  it("одинаково сужает видимость, когда держатель теряет доступ", async () => {
    const { reserved } = await expectSameAnswer(
      async function openEdit() {
        reset(baseRow("OPEN", { visibility: "PUBLIC" }));
        return updateGift(HEADERS, "g1", { visibility: "SECRET" });
      },
      async function reservedEdit() {
        reset(reservedRow("ACTIVE", false, { visibility: "PUBLIC" }));
        return updateGift(HEADERS, "g1", { visibility: "SECRET" });
      },
    );

    expect(reserved).toMatchObject({ ok: true, data: { visibility: "SECRET" } });
    // The holder lost access, so the reservation is gone and they were told.
    expect(state.row).toMatchObject({ status: "OPEN", reservedById: null });
    expect(state.notifications).toHaveLength(1);
  });

  it("одинаково сужает видимость, когда друг-держатель сохраняет доступ", async () => {
    const { reserved } = await expectSameAnswer(
      async function openEdit() {
        reset(baseRow("OPEN", { visibility: "PUBLIC" }));
        return updateGift(HEADERS, "g1", { visibility: "FRIENDS" });
      },
      async function reservedEdit() {
        reset(reservedRow("ACTIVE", false, { visibility: "PUBLIC" }));
        state.relations = { blocked: false, friend: true, subscriber: false, contactMatch: false };
        return updateGift(HEADERS, "g1", { visibility: "FRIENDS" });
      },
    );

    expect(reserved).toMatchObject({ ok: true, data: { visibility: "FRIENDS" } });
    expect(state.row).toMatchObject({ status: "RESERVED", reservedById: HOLDER });
  });

  it("одинаково отвечает на preflight видимости", async () => {
    await expectSameAnswer(
      async function openPreview() {
        reset(baseRow("OPEN", { visibility: "PUBLIC" }));
        return previewGiftVisibility(HEADERS, "g1", "SECRET");
      },
      async function reservedPreview() {
        reset(reservedRow("ACTIVE", true, { visibility: "PUBLIC" }));
        return previewGiftVisibility(HEADERS, "g1", "SECRET");
      },
    );
  });

  it("одинаково закрывает «Получено»", async () => {
    await expectSameAnswer(
      async function openClose() {
        reset(baseRow("OPEN"));
        return closeGift(HEADERS, "g1");
      },
      async function reservedClose() {
        reset(reservedRow("ACTIVE", true));
        return closeGift(HEADERS, "g1");
      },
    );
  });

  it("одинаково отменяет закрытие", async () => {
    const closedAt = new Date(Date.now() - 60_000);
    await expectSameAnswer(
      async function openUndo() {
        reset(baseRow("CLOSED", { closedAt, closedFromStatus: "OPEN" }));
        return undoGiftClose(HEADERS, "g1");
      },
      async function reservedUndo() {
        reset(
          reservedRow("ACTIVE", false, { status: "CLOSED", closedAt, closedFromStatus: "RESERVED" }),
        );
        return undoGiftClose(HEADERS, "g1");
      },
    );
  });

  it("одинаково возвращает желание из архива", async () => {
    const archivedAt = new Date("2026-11-20T00:00:00.000Z");
    await expectSameAnswer(
      async function openRestore() {
        reset(baseRow("OPEN", { archivedAt }));
        return restoreGift(HEADERS, "g1", { expiresOn: null });
      },
      async function leftoverRestore() {
        // The archive targets OPEN rows only, so a reserved wish never reaches it;
        // the leftover reservation columns must still change nothing.
        reset(reservedRow("ACTIVE", true, { status: "OPEN", archivedAt }));
        return restoreGift(HEADERS, "g1", { expiresOn: null });
      },
    );
  });

  it("одинаково удаляет желание", async () => {
    await expectSameAnswer(
      async function openDelete() {
        reset(baseRow("OPEN"));
        return deleteGift(HEADERS, "g1");
      },
      async function reservedDelete() {
        reset(reservedRow("ACTIVE", false));
        return deleteGift(HEADERS, "g1");
      },
    );
    expect(state.row).toBeNull();
    expect(state.notifications).toHaveLength(1);
  });

  it("не имеет владельческих маршрутов брони: любой id отвечает одним 404", async () => {
    // The owner's release/preview/keep routes are gone (D-49): the files must not
    // come back, otherwise the answer could differ again.
    const removed = [
      "../../app/api/v1/me/gifts/[id]/reservation/route.ts",
      "../../app/api/v1/me/gifts/[id]/reservation/keep/route.ts",
    ];
    for (const path of removed) {
      expect(existsSync(new URL(path, import.meta.url))).toBe(false);
    }

    const catchAll = await import("@/app/api/v1/[...slug]/route");
    const answers: Response[] = [];
    for (const handler of [catchAll.GET, catchAll.DELETE, catchAll.POST]) {
      for (const id of ["g1", "g-foreign", "g-reserved"]) {
        answers.push(await handler(new Request(`http://x/api/v1/me/gifts/${id}/reservation`)));
      }
    }

    const bodies = await Promise.all(answers.map((response) => response.json()));
    expect(answers.map((response) => response.status)).toEqual(answers.map(() => 404));
    for (const body of bodies) expect(body).toEqual(bodies[0]);
    expect(bodies[0]).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: expect.any(String),
    });
  });
});
