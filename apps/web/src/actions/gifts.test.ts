import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  findUnique,
  create,
  findFirst,
  txFindFirst,
  update,
  releaseMany,
  deleteMany,
  tagFindMany,
  tagDeleteMany,
  tagCreateMany,
  transaction,
  relationsBetween,
  PrismaClientKnownRequestError,
} = vi.hoisted(() => {
    /** Stands in for the generated class, so a test can shape the `code` and `meta` the use-cases read. */
    class PrismaClientKnownRequestError extends Error {
      code: string;
      meta?: Record<string, unknown>;

      constructor(message: string, { code, meta }: { code: string; meta?: Record<string, unknown> }) {
        super(message);
        this.code = code;
        this.meta = meta;
      }
    }

    return {
      getSession: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      txFindFirst: vi.fn(),
      update: vi.fn(),
      releaseMany: vi.fn(),
      deleteMany: vi.fn(),
      tagFindMany: vi.fn(),
      tagDeleteMany: vi.fn(),
      tagCreateMany: vi.fn(),
      transaction: vi.fn(),
      relationsBetween: vi.fn(),
      PrismaClientKnownRequestError,
    };
  });

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    list: { findUnique },
    gift: { create, findFirst, update, updateMany: releaseMany, deleteMany },
    tag: { findMany: tagFindMany },
    giftTag: { deleteMany: tagDeleteMany, createMany: tagCreateMany },
    $transaction: transaction,
  },
}));
vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError } }));
vi.mock("@/lib/relationships", () => ({ relationshipReader: { relationsBetween } }));

import { giftCardSchema } from "@gift-list/contracts";

import { createGift, deleteGift, getGift, previewGiftVisibility, updateGift } from "./gifts";

const headers = new Headers();

type Row = {
  id: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: "USD" | "EUR" | "CNY" | "BYN" | "RUB" | null;
  linkUrl: string | null;
  visibility: "PUBLIC" | "FRIENDS" | "SECRET";
  quantity: "SINGLE" | "UNLIMITED";
  expiresOn: Date | null;
  archivedAt: Date | null;
  status: "OPEN" | "RESERVED" | "CLOSED";
  reservationPhase: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  holderVisibleToOwner: boolean;
  reservedBy: { id: string; nick: string; name: string } | null;
  /** A stored read carries it; the card read does not, and the mapper ignores it. */
  reservedById: string | null;
  list: { ownerId: string };
  tags: { tagId: string | null; customText: string | null; tag: { slug: string; labels: unknown } | null }[];
};

/** A row of the shared owner select: the same shape create and update hand back. */
function giftRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "g1",
    title: "Книга",
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    status: "OPEN",
    reservationPhase: null,
    holderVisibleToOwner: false,
    reservedBy: null,
    reservedById: null,
    list: { ownerId: "u1" },
    tags: [],
    ...overrides,
  };
}

/** The stored values `updateGift` and the preflight read before they decide. */
type Stored = {
  priceAmount: number | null;
  priceCurrency: "USD" | "EUR" | "CNY" | "BYN" | "RUB" | null;
  status: "OPEN" | "RESERVED" | "CLOSED";
  visibility: "PUBLIC" | "FRIENDS" | "SECRET";
  quantity: "SINGLE" | "UNLIMITED";
  archivedAt: Date | null;
  reservedById: string | null;
};

function stored(overrides: Partial<Stored> = {}): Stored {
  return {
    priceAmount: null,
    priceCurrency: null,
    status: "OPEN",
    visibility: "PUBLIC",
    quantity: "SINGLE",
    archivedAt: null,
    reservedById: null,
    ...overrides,
  };
}

/** Queue the in-transaction stored read and then the card the re-read returns. */
function withStored(values: Partial<Stored>, card: Row = giftRow()) {
  txFindFirst.mockResolvedValueOnce(stored(values)).mockResolvedValueOnce(card);
}

/** The relation facts of the reservation holder; the tests override them. */
function holderRelations(overrides: Record<string, boolean> = {}) {
  return {
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
    ...overrides,
  };
}

/**
 * CLE-82/S23.2b: the write is a CAS on the snapshot the transaction read, so the
 * `where` carries the `status` and the holder of that read, not «not CLOSED».
 */
function snapshot(status: "OPEN" | "RESERVED" = "OPEN", reservedById: string | null = null) {
  return { status, reservedById };
}

function okData(result: Awaited<ReturnType<typeof createGift>>) {
  if (!result.ok) throw new Error(`unexpected error: ${result.code}`);
  return result.data;
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  create.mockReset();
  findFirst.mockReset();
  txFindFirst.mockReset();
  update.mockReset();
  releaseMany.mockReset();
  deleteMany.mockReset();
  tagFindMany.mockReset();
  tagDeleteMany.mockReset();
  tagCreateMany.mockReset();
  transaction.mockReset();
  relationsBetween.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1" });
  create.mockResolvedValue(giftRow());
  findFirst.mockResolvedValue(null);
  // The in-transaction read serves both the stored row and the final card.
  txFindFirst.mockResolvedValue(giftRow());
  update.mockResolvedValue({ id: "g1" });
  releaseMany.mockResolvedValue({ count: 1 });
  deleteMany.mockResolvedValue({ count: 0 });
  tagFindMany.mockResolvedValue([]);
  tagDeleteMany.mockResolvedValue({ count: 0 });
  tagCreateMany.mockResolvedValue({ count: 0 });
  relationsBetween.mockResolvedValue(holderRelations());
  // A stand-in for an interactive transaction: it runs the callback with the
  // same mocked delegates, so the test sees the order of the writes.
  transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        gift: { findFirst: txFindFirst, update, updateMany: releaseMany },
        tag: { findMany: tagFindMany },
        giftTag: { deleteMany: tagDeleteMany, createMany: tagCreateMany },
      }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getGift", () => {
  it("requires a session and does not touch the db", async () => {
    getSession.mockResolvedValue(null);

    expect(await getGift(headers, "g1")).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  /** AD-6/AD-8: ownership and "not archived" ride in the read's `where`. */
  it("reads through the owner gate", async () => {
    getSession.mockResolvedValue({ user: { id: "u2" }, session: { token: "t" } });
    findFirst.mockResolvedValue(giftRow({ id: "g7", list: { ownerId: "u2" } }));

    await getGift(headers, "g7");

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "g7", archivedAt: null, list: { ownerId: "u2" } },
      select: expect.any(Object),
    });
  });

  /** AD-7: the edit form is the owner branch, so the owner opens a SECRET wish. */
  it("opens the owner's own SECRET gift", async () => {
    findFirst.mockResolvedValue(giftRow({ id: "g7", visibility: "SECRET" }));

    const card = okData(await getGift(headers, "g7"));

    expect(card).toMatchObject({ id: "g7", visibility: "SECRET" });
  });

  /**
   * AD-7: even if the `where` let a row through by mistake, the gate answers the
   * same NOT_FOUND, so a foreign wish never leaks.
   */
  it("answers NOT_FOUND when the row belongs to another list", async () => {
    findFirst.mockResolvedValue(giftRow({ id: "g7", list: { ownerId: "u-other" } }));

    const result = await getGift(headers, "g7");

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(result).not.toHaveProperty("data");
    expect(JSON.stringify(result)).not.toContain("Книга");
  });

  /** A foreign, archived or missing gift all match nothing, so all answer the same (AD-8). */
  it("answers NOT_FOUND when the gift is not the owner's", async () => {
    findFirst.mockResolvedValue(null);

    expect(await getGift(headers, "g-other")).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("returns the card matching the AD-12 contract", async () => {
    findFirst.mockResolvedValue(
      giftRow({
        id: "g7",
        title: "Наушники",
        visibility: "FRIENDS",
        status: "RESERVED",
        reservationPhase: "GIVEN",
      }),
    );

    const card = okData(await getGift(headers, "g7"));

    expect(giftCardSchema.safeParse(card).success).toBe(true);
    expect(card).toMatchObject({
      id: "g7",
      title: "Наушники",
      visibility: "FRIENDS",
      status: "RESERVED",
      reservedBy: null,
      ownerAction: "CONFIRM_GIVEN",
    });
  });

  /** Story 2.5: the edit form prefill carries the owner's tags, labelled by the server. */
  it("returns the stored tags on the edit card", async () => {
    findFirst.mockResolvedValue(
      giftRow({
        id: "g7",
        tags: [
          { tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта" } } },
          { tagId: null, customText: "своё", tag: null },
        ],
      }),
    );

    const card = okData(await getGift(headers, "g7"));

    expect(card.tags).toEqual([
      { catalogId: null, label: "своё" },
      { catalogId: "tag_dream", label: "мечта" },
    ]);
  });
});

describe("createGift", () => {
  it("requires a session", async () => {
    getSession.mockResolvedValue(null);

    expect(await createGift(headers, { title: "Книга" })).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a body without a title", async () => {
    expect(await createGift(headers, {})).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "title",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an unknown currency", async () => {
    expect(
      await createGift(headers, { title: "Книга", priceAmount: 100, priceCurrency: "GBP" }),
    ).toMatchObject({ ok: false, code: "VALIDATION", field: "priceCurrency" });
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["not a link", "ftp://example.com/item", "javascript:alert(1)"])(
    "rejects the link %s",
    async (linkUrl) => {
      expect(await createGift(headers, { title: "Книга", linkUrl })).toMatchObject({
        ok: false,
        code: "VALIDATION",
        field: "linkUrl",
      });
      expect(create).not.toHaveBeenCalled();
    },
  );

  /** AD-6/AD-8/AD-25/ARCH-A17: the defaults live in the contract, not the use-case. */
  it("creates a minimal wish with the contract defaults", async () => {
    await createGift(headers, { title: "Книга" });

    expect(create).toHaveBeenCalledWith({
      data: {
        listId: "l1",
        title: "Книга",
        description: null,
        priceAmount: null,
        priceCurrency: null,
        linkUrl: null,
        visibility: "PUBLIC",
        quantity: "SINGLE",
        status: "OPEN",
      },
      select: expect.any(Object),
    });
  });

  it("creates an explicit UNLIMITED wish", async () => {
    await createGift(headers, { title: "Книга", quantity: "UNLIMITED" });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: "UNLIMITED" }) }),
    );
  });

  it("rejects an unknown quantity", async () => {
    expect(await createGift(headers, { title: "Книга", quantity: "MANY" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "quantity",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("stores USD when an amount comes without a currency", async () => {
    await createGift(headers, { title: "Книга", priceAmount: 1250 });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceAmount: 1250, priceCurrency: "USD" }),
      }),
    );
  });

  /** AD-6: the list belongs to the session user; the body cannot choose it. */
  it("looks the list up by the session user id", async () => {
    getSession.mockResolvedValue({ user: { id: "u2" }, session: { token: "t" } });
    findUnique.mockResolvedValue({ id: "l2" });
    create.mockResolvedValue(giftRow());

    await createGift(headers, { title: "Книга" });

    expect(findUnique).toHaveBeenCalledWith({
      where: { ownerId: "u2" },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ listId: "l2" }) }),
    );
  });

  it("rejects listId and ownerId in the body instead of honouring them", async () => {
    expect(
      await createGift(headers, { title: "Книга", listId: "l9", ownerId: "u9" }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND when the session user has no list", async () => {
    findUnique.mockResolvedValue(null);

    expect(await createGift(headers, { title: "Книга" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns an owner card matching the AD-12 contract", async () => {
    create.mockResolvedValue(giftRow({ id: "g7", title: "Наушники" }));

    const result = await createGift(headers, { title: "Наушники" });
    const card = okData(result);

    expect(giftCardSchema.safeParse(card).success).toBe(true);
    expect(card).toMatchObject({
      id: "g7",
      title: "Наушники",
      status: "OPEN",
      visibility: "PUBLIC",
      reservedBy: null,
      ownerAction: null,
    });
  });

  /**
   * D1 of the epic-2 QA report: PostgreSQL cannot store `U+0000`, so the body
   * must answer VALIDATION with the field named instead of a 500 without an
   * envelope. The contract rejects it before any read or write.
   */
  it.each<[string, Record<string, unknown>, string]>([
    ["title", { title: "a\u0000b" }, "title"],
    ["description", { title: "Книга", description: "a\u0000b" }, "description"],
    ["linkUrl", { title: "Книга", linkUrl: "https://example.com/a\u0000b" }, "linkUrl"],
    [
      "a fixed tag id",
      { title: "Книга", tags: [{ catalogId: "tag\u00001" }] },
      "tags.0.catalogId",
    ],
  ])("rejects NUL in %s before the database", async (_label, body, field) => {
    expect(await createGift(headers, body)).toMatchObject({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field,
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(tagFindMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("updateGift", () => {
  it("requires a session", async () => {
    getSession.mockResolvedValue(null);

    expect(await updateGift(headers, "g1", { title: "Книга" })).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  /** An empty body trips the schema's "at least one field" refine, which carries no path. */
  it("rejects an empty body without touching the db", async () => {
    const result = await updateGift(headers, "g1", {});

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(result).not.toHaveProperty("field");
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an over-long title", async () => {
    expect(await updateGift(headers, "g1", { title: "ж".repeat(121) })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "title",
    });
    expect(update).not.toHaveBeenCalled();
  });

  /** D1 of the epic-2 QA report: NUL reaches no read and no write. */
  it.each<[string, Record<string, unknown>, string]>([
    ["title", { title: "a\u0000b" }, "title"],
    ["description", { description: "a\u0000b" }, "description"],
    ["linkUrl", { linkUrl: "https://example.com/a\u0000b" }, "linkUrl"],
    ["a fixed tag id", { tags: [{ catalogId: "tag\u00001" }] }, "tags.0.catalogId"],
  ])("rejects NUL in %s before the database", async (_label, body, field) => {
    expect(await updateGift(headers, "g1", body)).toMatchObject({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field,
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(tagDeleteMany).not.toHaveBeenCalled();
  });

  /**
   * The strict object rejects the key, but zod attaches `unrecognized_keys` to the
   * object itself, so the envelope names no field — the same shape `createGift`
   * answers for a smuggled `ownerId`.
   */
  it("rejects an unknown key instead of writing it", async () => {
    const result = await updateGift(headers, "g1", { title: "Книга", ownerId: "u2" });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(result).not.toHaveProperty("field");
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * AD-6/AD-7: ownership is the first rule, so a foreign or missing gift matches
   * nothing in the stored read and answers NOT_FOUND without touching the row.
   * The body only carries the keys that came in.
   */
  it("writes through the owner gate and sends only the provided keys", async () => {
    getSession.mockResolvedValue({ user: { id: "u2" }, session: { token: "t" } });

    await updateGift(headers, "g7", { title: "Новое название" });

    expect(txFindFirst).toHaveBeenCalledWith({
      where: { id: "g7", list: { ownerId: "u2" } },
      select: {
        priceAmount: true,
        priceCurrency: true,
        status: true,
        visibility: true,
        quantity: true,
        archivedAt: true,
        reservedById: true,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "g7", archivedAt: null, ...snapshot() },
      data: { title: "Новое название" },
      select: { id: true },
    });
  });

  /** AD-8 (ред. 2026-11-11): the owner's own archived wish is read-only, not hidden. */
  it("answers VALIDATION with the archived reason for the owner's archived wish", async () => {
    txFindFirst.mockResolvedValueOnce(stored({ archivedAt: new Date("2026-01-01T00:00:00.000Z") }));

    expect(await updateGift(headers, "g1", { title: "Книга" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "GIFT_ARCHIVED",
    });
    expect(update).not.toHaveBeenCalled();
    expect(releaseMany).not.toHaveBeenCalled();
  });

  /** AD-8: `CLOSED` is read-only for every edit, not only for a visibility change. */
  it.each([
    { title: "Книга" },
    { visibility: "SECRET" },
    { quantity: "UNLIMITED" },
    { tags: [] },
  ])("answers VALIDATION with the closed reason for a CLOSED wish: %j", async (body) => {
    txFindFirst.mockResolvedValueOnce(stored({ status: "CLOSED" }));

    expect(await updateGift(headers, "g1", body)).toMatchObject({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "GIFT_CLOSED",
    });
    expect(update).not.toHaveBeenCalled();
    expect(releaseMany).not.toHaveBeenCalled();
    expect(tagDeleteMany).not.toHaveBeenCalled();
  });

  /** AD-25/FR-10: `null` clears a field; a cleared amount clears the currency with it. */
  it("clears description, link and price when `null` comes in", async () => {
    await updateGift(headers, "g1", { description: null, linkUrl: null, priceAmount: null });

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot() },
      data: { description: null, linkUrl: null, priceAmount: null, priceCurrency: null },
      select: { id: true },
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  /**
   * AD-25/Н1 (epic-2 QA report): an amount sent alone keeps the stored currency —
   * an absent field means "leave it", not "reset to USD". The contract leaves the
   * key out, so the use-case reads the stored currency.
   */
  it("keeps the stored currency when only an amount comes in", async () => {
    withStored({ priceAmount: 1000, priceCurrency: "RUB" });

    await updateGift(headers, "g1", { priceAmount: 2000 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceAmount: 2000, priceCurrency: "RUB" } }),
    );
  });

  /** AD-25: a wish that had no price gets `USD`, since there is no currency to keep. */
  it("prices an amount as USD when the wish had no price", async () => {
    withStored({ priceAmount: null, priceCurrency: null });

    await updateGift(headers, "g1", { priceAmount: 1250 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceAmount: 1250, priceCurrency: "USD" } }),
    );
  });

  /** A legacy row may hold an amount without a currency; the repair is the same `USD` (AD-25). */
  it("repairs an amount that has no stored currency with USD", async () => {
    withStored({ priceAmount: 1000, priceCurrency: null });

    await updateGift(headers, "g1", { priceAmount: 1500 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceAmount: 1500, priceCurrency: "USD" } }),
    );
  });

  /** D2: an explicit `null` currency over a stored amount is a price without a currency. */
  it("answers VALIDATION when a null currency targets a stored amount", async () => {
    withStored({ priceAmount: 1000, priceCurrency: "EUR" });

    expect(await updateGift(headers, "g1", { priceCurrency: null })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "priceCurrency",
    });
    expect(update).not.toHaveBeenCalled();
  });

  /** Without a stored amount there is nothing to price, so a null currency is a no-op. */
  it("keeps a wish without a price when a null currency comes in", async () => {
    withStored({ priceAmount: null, priceCurrency: null });

    await updateGift(headers, "g1", { priceCurrency: null });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceCurrency: null } }),
    );
  });

  /** The contract rejects the pair before the database: an amount never lands with a null currency. */
  it("rejects an amount with an explicit null currency before reading the gift", async () => {
    expect(
      await updateGift(headers, "g1", { priceAmount: 1000, priceCurrency: null }),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "priceCurrency",
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  /** AD-25: a currency alone keeps the stored amount, so the amount is read first. */
  it("keeps the stored amount when only a currency comes in", async () => {
    withStored({ priceAmount: 5000, priceCurrency: "RUB" });

    await updateGift(headers, "g1", { priceCurrency: "EUR" });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceCurrency: "EUR" } }),
    );
  });

  it("drops a currency that has no stored amount to price", async () => {
    withStored({ priceAmount: null });

    await updateGift(headers, "g1", { priceCurrency: "EUR" });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceCurrency: null } }),
    );
  });

  it("answers NOT_FOUND without writing when the gift is not the owner's", async () => {
    txFindFirst.mockResolvedValueOnce(null);

    expect(await updateGift(headers, "g-other", { priceCurrency: "EUR" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(update).not.toHaveBeenCalled();
  });

  /** The amount-only path reads the stored currency, so it answers NOT_FOUND the same way. */
  it("answers NOT_FOUND without writing when an amount targets a foreign gift", async () => {
    txFindFirst.mockResolvedValueOnce(null);

    expect(await updateGift(headers, "g-other", { priceAmount: 2000 })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(update).not.toHaveBeenCalled();
  });

  /** A foreign, archived or missing gift all match nothing, so all answer the same (AD-8). */
  it("answers NOT_FOUND when the update matches no row (P2025)", async () => {
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );

    expect(await updateGift(headers, "g1", { title: "Книга" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("returns the edited card matching the AD-12 contract", async () => {
    withStored(
      {},
      giftRow({
        id: "g7",
        title: "Наушники",
        description: "Беспроводные",
        priceAmount: 19900,
        priceCurrency: "BYN",
        linkUrl: "https://shop.example/headphones",
        visibility: "SECRET",
        status: "RESERVED",
        reservationPhase: "GIVEN",
      }),
    );

    const card = okData(await updateGift(headers, "g7", { title: "Наушники" }));

    expect(giftCardSchema.safeParse(card).success).toBe(true);
    expect(card).toMatchObject({
      id: "g7",
      title: "Наушники",
      priceAmount: 19900,
      priceCurrency: "BYN",
      status: "RESERVED",
      reservedBy: null,
      ownerAction: "CONFIRM_GIVEN",
    });
  });

  it.each([
    ["a plain failure", () => new Error("boom")],
    [
      "another Prisma code",
      () => new PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002" }),
    ],
  ])("rethrows %s instead of answering NOT_FOUND", async (_label, makeError) => {
    const error = makeError();
    update.mockRejectedValue(error);

    await expect(updateGift(headers, "g1", { title: "Книга" })).rejects.toBe(error);
  });

  /** Story 2.3/AD-8: an OPEN wish takes a new visibility, written while still OPEN. */
  it("changes the visibility of an OPEN wish", async () => {
    withStored({ visibility: "PUBLIC" }, giftRow({ visibility: "SECRET" }));

    const card = okData(await updateGift(headers, "g1", { visibility: "SECRET" }));

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot() },
      data: { visibility: "SECRET" },
      select: { id: true },
    });
    expect(relationsBetween).not.toHaveBeenCalled();
    expect(releaseMany).not.toHaveBeenCalled();
    expect(card).toMatchObject({ visibility: "SECRET" });
  });

  /**
   * FR-10 ред. 2026-11-11 (CLE-82): a RESERVED wish takes a new visibility. If
   * the accepted-friend holder keeps AD-7 access, the reservation stays.
   */
  it("keeps a RESERVED wish's reservation when a friend keeps access to FRIENDS", async () => {
    withStored(
      { status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" },
      giftRow({ status: "RESERVED", visibility: "FRIENDS" }),
    );
    relationsBetween.mockResolvedValue(holderRelations({ friend: true }));

    const card = okData(await updateGift(headers, "g1", { visibility: "FRIENDS" }));

    expect(relationsBetween).toHaveBeenCalledWith("u2", "u1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot("RESERVED", "u2") },
      data: { visibility: "FRIENDS" },
      select: { id: true },
    });
    expect(releaseMany).not.toHaveBeenCalled();
    expect(card).toMatchObject({ status: "RESERVED", visibility: "FRIENDS" });
  });

  /**
   * The holder reserved through the list link or as a subscriber/contact match:
   * PUBLIC was open to them, FRIENDS is not. The reservation is released through
   * `GiftStatusService` in the same transaction.
   */
  it.each([
    ["a link visitor", {}],
    ["a subscriber", { subscriber: true }],
    ["a contact match", { contactMatch: true }],
  ])("releases the reservation of %s narrowed to FRIENDS", async (_label, relations) => {
    withStored(
      { status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" },
      giftRow({ status: "OPEN", visibility: "FRIENDS", reservedBy: null }),
    );
    relationsBetween.mockResolvedValue(holderRelations(relations));

    const card = okData(await updateGift(headers, "g1", { visibility: "FRIENDS" }));

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot("RESERVED", "u2") },
      data: { visibility: "FRIENDS" },
      select: { id: true },
    });
    expect(releaseMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED" },
      data: expect.objectContaining({
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
      }),
    });
    expect(card).toMatchObject({ status: "OPEN", visibility: "FRIENDS", reservedBy: null });
  });

  it("releases the reservation when the owner picks SECRET", async () => {
    withStored(
      { status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" },
      giftRow({ status: "OPEN", visibility: "SECRET" }),
    );

    const card = okData(await updateGift(headers, "g1", { visibility: "SECRET" }));

    expect(releaseMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED" },
      data: expect.objectContaining({ reservedById: null }),
    });
    expect(card.status).toBe("OPEN");
  });

  /** A-14: a block, or a holder who already had no access, never releases by itself. */
  it("keeps the reservation when the holder is blocked and had no access before", async () => {
    withStored(
      { status: "RESERVED", visibility: "FRIENDS", reservedById: "u2" },
      giftRow({ status: "RESERVED", visibility: "SECRET" }),
    );
    relationsBetween.mockResolvedValue(holderRelations({ blocked: true }));

    await updateGift(headers, "g1", { visibility: "SECRET" });

    expect(releaseMany).not.toHaveBeenCalled();
  });

  /** Widening after a release does not bring the reservation back. */
  it("does not restore a released reservation when the visibility widens again", async () => {
    withStored(
      { status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" },
      giftRow({ status: "OPEN", visibility: "FRIENDS" }),
    );
    const released = okData(await updateGift(headers, "g1", { visibility: "FRIENDS" }));
    expect(released.status).toBe("OPEN");
    expect(releaseMany).toHaveBeenCalledTimes(1);

    // The wish is OPEN now; the holder's columns are gone, so widening writes
    // only the field and the service is never asked to release again.
    txFindFirst
      .mockResolvedValueOnce(stored({ status: "OPEN", visibility: "FRIENDS" }))
      .mockResolvedValueOnce(giftRow({ status: "OPEN", visibility: "PUBLIC" }));

    const widened = okData(await updateGift(headers, "g1", { visibility: "PUBLIC" }));

    expect(releaseMany).toHaveBeenCalledTimes(1);
    expect(widened).toMatchObject({ status: "OPEN", visibility: "PUBLIC", reservedBy: null });
  });

  /** The form of a reserved wish resends the stored value; that is not a change. */
  it("ignores an unchanged visibility and still saves the other fields", async () => {
    withStored(
      { status: "RESERVED", visibility: "PUBLIC" },
      giftRow({ title: "Новое название", status: "RESERVED" }),
    );

    const card = okData(
      await updateGift(headers, "g1", { title: "Новое название", visibility: "PUBLIC" }),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot("RESERVED") },
      data: { title: "Новое название" },
      select: { id: true },
    });
    expect(relationsBetween).not.toHaveBeenCalled();
    expect(releaseMany).not.toHaveBeenCalled();
    expect(card.title).toBe("Новое название");
  });

  /**
   * FR-10 ред. 2026-11-11: a reservation made between the form and the write no
   * longer rejects the visibility change — it is applied and the holder's access
   * is evaluated for the new value.
   */
  it("applies a visibility change when the wish is RESERVED at the write", async () => {
    withStored(
      { status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" },
      giftRow({ status: "OPEN", visibility: "SECRET" }),
    );

    const card = okData(await updateGift(headers, "g1", { visibility: "SECRET" }));

    expect(card).toMatchObject({ status: "OPEN", visibility: "SECRET" });
    expect(releaseMany).toHaveBeenCalledTimes(1);
  });

  /**
   * CLE-82/S23.2b: the booking race. The snapshot read saw `OPEN` with no holder;
   * by the time the visibility write lands the wish is `RESERVED`, so the CAS on
   * `status`/`reservedById` fails and the transaction repeats. The fresh read
   * knows the holder, the same rule takes SECRET away from their access, and the
   * release rides in the new transaction: the wish never ends up RESERVED with a
   * visibility its holder cannot see.
   */
  it("re-reads and releases the reservation that landed between the read and the write", async () => {
    txFindFirst
      .mockResolvedValueOnce(stored({ status: "OPEN", visibility: "PUBLIC" }))
      .mockResolvedValueOnce(
        stored({ status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" }),
      )
      .mockResolvedValueOnce(giftRow({ status: "OPEN", visibility: "SECRET" }));
    update.mockRejectedValueOnce(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );
    findFirst.mockResolvedValue({ status: "RESERVED", archivedAt: null });

    const card = okData(await updateGift(headers, "g1", { visibility: "SECRET" }));

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "g1", archivedAt: null, ...snapshot() },
      data: { visibility: "SECRET" },
      select: { id: true },
    });
    expect(update).toHaveBeenLastCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot("RESERVED", "u2") },
      data: { visibility: "SECRET" },
      select: { id: true },
    });
    expect(relationsBetween).toHaveBeenCalledWith("u2", "u1");
    expect(releaseMany).toHaveBeenCalledWith({
      where: { id: "g1", status: "RESERVED" },
      data: expect.objectContaining({
        status: "OPEN",
        reservedById: null,
        reservedAt: null,
        holderVisibleToOwner: false,
      }),
    });
    expect(card).toMatchObject({ status: "OPEN", visibility: "SECRET", reservedBy: null });
  });

  /**
   * The same race with a friend as the holder: FRIENDS still lets them see the
   * wish, so the re-read keeps the reservation and only the field is written.
   */
  it("keeps the reservation when the raced holder is a friend and keeps access", async () => {
    txFindFirst
      .mockResolvedValueOnce(stored({ status: "OPEN", visibility: "PUBLIC" }))
      .mockResolvedValueOnce(
        stored({ status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" }),
      )
      .mockResolvedValueOnce(giftRow({ status: "RESERVED", visibility: "FRIENDS" }));
    update.mockRejectedValueOnce(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );
    findFirst.mockResolvedValue({ status: "RESERVED", archivedAt: null });
    relationsBetween.mockResolvedValue(holderRelations({ friend: true }));

    const card = okData(await updateGift(headers, "g1", { visibility: "FRIENDS" }));

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot("RESERVED", "u2") },
      data: { visibility: "FRIENDS" },
      select: { id: true },
    });
    expect(releaseMany).not.toHaveBeenCalled();
    expect(card).toMatchObject({ status: "RESERVED", visibility: "FRIENDS" });
  });

  /**
   * The retry is bounded: a row that keeps moving under the edit surfaces as a
   * conflict the client reloads, never as NOT_FOUND — the wish still exists.
   */
  it("answers CONFLICT, not NOT_FOUND, when the wish keeps moving under the edit", async () => {
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );
    findFirst.mockResolvedValue({ status: "RESERVED", archivedAt: null });

    const result = await updateGift(headers, "g1", { visibility: "SECRET" });

    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(releaseMany).not.toHaveBeenCalled();
  });

  /** The CAS can also lose to an archive or a close after the stored read. */
  it("answers the archived reason when the write loses to an archive", async () => {
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );
    findFirst.mockResolvedValue({ status: "OPEN", archivedAt: new Date("2026-01-01T00:00:00.000Z") });

    expect(await updateGift(headers, "g1", { title: "Книга" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "GIFT_ARCHIVED",
    });
  });

  it("answers the closed reason when the write loses to a close", async () => {
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );
    findFirst.mockResolvedValue({ status: "CLOSED", archivedAt: null });

    expect(await updateGift(headers, "g1", { title: "Книга" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "GIFT_CLOSED",
    });
  });

  it("answers NOT_FOUND when the guarded write finds no owned row", async () => {
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );
    findFirst.mockResolvedValue(null);

    expect(await updateGift(headers, "g1", { visibility: "SECRET" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("answers NOT_FOUND without writing when a visibility change targets a foreign gift", async () => {
    txFindFirst.mockResolvedValueOnce(null);

    expect(await updateGift(headers, "g-other", { visibility: "SECRET" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an unknown quantity", async () => {
    expect(await updateGift(headers, "g1", { quantity: "MANY" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "quantity",
    });
    expect(update).not.toHaveBeenCalled();
  });

  /** Story 2.5/FR-41: an OPEN wish takes a new quantity, written while still OPEN. */
  it("changes the quantity of an OPEN wish", async () => {
    withStored(
      { quantity: "SINGLE" },
      giftRow({ quantity: "UNLIMITED" }),
    );

    const card = okData(await updateGift(headers, "g1", { quantity: "UNLIMITED" }));

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot() },
      data: { quantity: "UNLIMITED" },
      select: { id: true },
    });
    expect(card.quantity).toBe("UNLIMITED");
  });

  it("writes quantity and visibility together on an OPEN wish", async () => {
    withStored(
      { quantity: "SINGLE", visibility: "PUBLIC" },
      giftRow({ quantity: "UNLIMITED", visibility: "SECRET" }),
    );

    await updateGift(headers, "g1", { quantity: "UNLIMITED", visibility: "SECRET" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot() },
      data: { quantity: "UNLIMITED", visibility: "SECRET" },
      select: { id: true },
    });
  });

  /** Story 2.5/AD-8: a reserved wish keeps its quantity. CLOSED is read-only entirely. */
  it("answers VALIDATION when changing the quantity of a RESERVED wish", async () => {
    withStored({ status: "RESERVED", quantity: "SINGLE" });

    expect(await updateGift(headers, "g1", { quantity: "UNLIMITED" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "quantity",
    });
    expect(update).not.toHaveBeenCalled();
  });

  /** A reserved wish's form resends the stored quantity; that is not a change. */
  it("ignores an unchanged quantity and still saves the other fields", async () => {
    withStored(
      { status: "RESERVED", quantity: "UNLIMITED" },
      giftRow({ title: "Новое название", status: "RESERVED", quantity: "UNLIMITED" }),
    );

    const card = okData(
      await updateGift(headers, "g1", { title: "Новое название", quantity: "UNLIMITED" }),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot("RESERVED") },
      data: { title: "Новое название" },
      select: { id: true },
    });
    expect(card.title).toBe("Новое название");
  });

  /**
   * FR-10 ред. 2026-11-11: a resent quantity is not a change, so it no longer
   * blocks the visibility rule — the narrowing is applied and the reservation is
   * released because SECRET takes the holder's access away.
   */
  it("applies the visibility of a RESERVED wish when quantity is resent unchanged", async () => {
    withStored(
      { status: "RESERVED", visibility: "PUBLIC", quantity: "SINGLE", reservedById: "u2" },
      giftRow({ status: "OPEN", visibility: "SECRET" }),
    );

    const card = okData(
      await updateGift(headers, "g1", { quantity: "SINGLE", visibility: "SECRET" }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { visibility: "SECRET" } }),
    );
    expect(releaseMany).toHaveBeenCalledTimes(1);
    expect(card.status).toBe("OPEN");
  });

  /**
   * Story 2.5 stays intact: a changed `quantity` on a reserved wish is rejected
   * even when a visibility change arrives in the same PATCH, and nothing is
   * written — the visibility is not applied "half-way".
   */
  it("names quantity when both quantity and visibility change on a RESERVED wish", async () => {
    withStored({ status: "RESERVED", visibility: "PUBLIC", quantity: "SINGLE" });

    expect(
      await updateGift(headers, "g1", { quantity: "UNLIMITED", visibility: "SECRET" }),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "quantity",
    });
    expect(update).not.toHaveBeenCalled();
    expect(releaseMany).not.toHaveBeenCalled();
  });

  /** AD-8: the write's `status: "OPEN"` loses to a reservation made after the read. */
  it("answers VALIDATION when the wish is reserved before the guarded quantity write lands", async () => {
    withStored({ status: "OPEN", quantity: "SINGLE" });
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );
    findFirst.mockResolvedValue({ status: "RESERVED", archivedAt: null });

    expect(await updateGift(headers, "g1", { quantity: "UNLIMITED" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "quantity",
    });
  });

  /**
   * AD-8/AD-9 atomicity: the release lives in the same transaction as the field
   * write, so a failed visibility write never leaves the reservation released.
   */
  it("does not release the reservation when the visibility write fails", async () => {
    withStored(
      { status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" },
      giftRow({ status: "OPEN", visibility: "SECRET" }),
    );
    const error = new Error("database is down");
    update.mockRejectedValue(error);

    await expect(updateGift(headers, "g1", { visibility: "SECRET" })).rejects.toBe(error);

    expect(releaseMany).not.toHaveBeenCalled();
  });

  /** No notification infrastructure exists yet (`deferred-work.md`): the release is silent. */
  it("imports no notification transport on the visibility release path", () => {
    const sources = [
      new URL("./gifts.ts", import.meta.url),
      new URL("../lib/gift-status-store.ts", import.meta.url),
      new URL("../domain/gift-status.ts", import.meta.url),
    ].map(function read(url) {
      return readFileSync(url, "utf8");
    });

    for (const source of sources) {
      expect(source).not.toMatch(/from ["']resend["']/);
      expect(source).not.toContain("NotificationService");
      expect(source).not.toContain("sendEmail");
    }
  });
});

describe("previewGiftVisibility", () => {
  it("requires a session and does not touch the db", async () => {
    getSession.mockResolvedValue(null);

    expect(await previewGiftVisibility(headers, "g1", "SECRET")).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for a foreign or missing wish", async () => {
    findFirst.mockResolvedValue(null);

    expect(await previewGiftVisibility(headers, "g-other", "SECRET")).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("answers the archived reason for the owner's archived wish", async () => {
    findFirst.mockResolvedValue(
      stored({ archivedAt: new Date("2026-01-01T00:00:00.000Z") }),
    );

    expect(await previewGiftVisibility(headers, "g1", "SECRET")).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "GIFT_ARCHIVED",
    });
  });

  it("answers the closed reason for a CLOSED wish", async () => {
    findFirst.mockResolvedValue(stored({ status: "CLOSED" }));

    expect(await previewGiftVisibility(headers, "g1", "SECRET")).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "GIFT_CLOSED",
    });
  });

  it("answers false for an OPEN wish and reads no relations", async () => {
    findFirst.mockResolvedValue(stored({ status: "OPEN" }));

    expect(await previewGiftVisibility(headers, "g1", "SECRET")).toEqual({
      ok: true,
      data: { wouldCancelReservation: false },
    });
    expect(relationsBetween).not.toHaveBeenCalled();
  });

  it("answers false for the stored value", async () => {
    findFirst.mockResolvedValue(
      stored({ status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" }),
    );

    expect(await previewGiftVisibility(headers, "g1", "PUBLIC")).toEqual({
      ok: true,
      data: { wouldCancelReservation: false },
    });
    expect(relationsBetween).not.toHaveBeenCalled();
  });

  it("answers false when the accepted-friend holder keeps FRIENDS access", async () => {
    findFirst.mockResolvedValue(
      stored({ status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" }),
    );
    relationsBetween.mockResolvedValue(holderRelations({ friend: true }));

    expect(await previewGiftVisibility(headers, "g1", "FRIENDS")).toEqual({
      ok: true,
      data: { wouldCancelReservation: false },
    });
    expect(relationsBetween).toHaveBeenCalledWith("u2", "u1");
  });

  it.each([
    ["a link visitor", {}],
    ["a subscriber", { subscriber: true }],
    ["a contact match", { contactMatch: true }],
  ])("answers true for %s narrowed from PUBLIC to FRIENDS", async (_label, relations) => {
    findFirst.mockResolvedValue(
      stored({ status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" }),
    );
    relationsBetween.mockResolvedValue(holderRelations(relations));

    expect(await previewGiftVisibility(headers, "g1", "FRIENDS")).toEqual({
      ok: true,
      data: { wouldCancelReservation: true },
    });
  });

  it("answers true for SECRET and false for a blocked holder", async () => {
    findFirst.mockResolvedValue(
      stored({ status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" }),
    );

    expect(await previewGiftVisibility(headers, "g1", "SECRET")).toEqual({
      ok: true,
      data: { wouldCancelReservation: true },
    });

    relationsBetween.mockResolvedValue(holderRelations({ blocked: true }));
    expect(await previewGiftVisibility(headers, "g1", "SECRET")).toEqual({
      ok: true,
      data: { wouldCancelReservation: false },
    });
  });

  /** The preflight is a read: no transaction, no field write, no status write. */
  it("writes nothing", async () => {
    findFirst.mockResolvedValue(
      stored({ status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" }),
    );

    await previewGiftVisibility(headers, "g1", "SECRET");

    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(releaseMany).not.toHaveBeenCalled();
  });
});

describe("gift tags", () => {
  const dreamRow = {
    tagId: "tag_dream",
    customText: null,
    tag: { slug: "dream", labels: { ru: "мечта" } },
  };
  const customRow = { tagId: null, customText: "своё", tag: null };

  it("creates fixed and custom tags with server-side eligibility", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    create.mockResolvedValue(giftRow({ tags: [dreamRow, customRow] }));

    const card = okData(
      await createGift(headers, {
        title: "Книга",
        tags: [{ catalogId: "tag_dream" }, { text: "  своё  " }],
      }),
    );

    expect(tagFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["tag_dream"] } },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: {
            create: [
              { tagId: "tag_dream", aggregateEligible: true },
              { customText: "своё", aggregateEligible: false },
            ],
          },
        }),
      }),
    );
    // AD-27: the fixed label is resolved on the server; custom text stays as typed.
    expect(card.tags).toEqual([
      { catalogId: null, label: "своё" },
      { catalogId: "tag_dream", label: "мечта" },
    ]);
  });

  it("creates no tags when the body has none", async () => {
    await createGift(headers, { title: "Книга" });

    expect(tagFindMany).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ data: expect.objectContaining({ tags: expect.anything() }) }),
    );
  });

  it("returns card tags with the custom tag first, then catalog slug order", async () => {
    tagFindMany.mockResolvedValue([
      { id: "tag_someday" },
      { id: "tag_dream" },
      { id: "tag_need_now" },
    ]);
    create.mockResolvedValue(
      giftRow({
        tags: [
          { tagId: "tag_someday", customText: null, tag: { slug: "someday", labels: { ru: "когда-нибудь" } } },
          { tagId: null, customText: "своё", tag: null },
          { tagId: "tag_dream", customText: null, tag: { slug: "dream", labels: { ru: "мечта" } } },
          { tagId: "tag_need_now", customText: null, tag: { slug: "need-now", labels: { ru: "нужно сейчас" } } },
        ],
      }),
    );

    const card = okData(
      await createGift(headers, {
        title: "Книга",
        tags: [
          { catalogId: "tag_someday" },
          { text: "своё" },
          { catalogId: "tag_dream" },
          { catalogId: "tag_need_now" },
        ],
      }),
    );

    expect(card.tags).toEqual([
      { catalogId: null, label: "своё" },
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: "tag_need_now", label: "нужно сейчас" },
      { catalogId: "tag_someday", label: "когда-нибудь" },
    ]);
  });

  it("rejects an unknown fixed tag id before writing the gift", async () => {
    tagFindMany.mockResolvedValue([]);

    expect(
      await createGift(headers, { title: "Книга", tags: [{ catalogId: "tag_missing" }] }),
    ).toMatchObject({ ok: false, code: "VALIDATION", field: "tags" });
    expect(create).not.toHaveBeenCalled();
  });

  it("accepts only the known fixed tag ids", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);

    expect(
      await createGift(headers, {
        title: "Книга",
        tags: [{ catalogId: "tag_dream" }, { catalogId: "tag_missing" }],
      }),
    ).toMatchObject({ ok: false, code: "VALIDATION", field: "tags" });
    expect(create).not.toHaveBeenCalled();
  });

  /** Q-10/F4: the catalog row disappeared between the check and the nested insert. */
  it("maps a catalog tag deleted during create to VALIDATION (P2003)", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    create.mockRejectedValue(
      new PrismaClientKnownRequestError("Foreign key constraint violated", {
        code: "P2003",
        // Real Prisma 7.10 + @prisma/adapter-pg shape for a nested create:
        // modelName is the operation root, the constraint is only in the adapter cause.
        meta: {
          modelName: "Gift",
          driverAdapterError: {
            cause: {
              kind: "ForeignKeyConstraintViolation",
              constraint: { index: "GiftTag_tagId_fkey" },
            },
          },
        },
      }),
    );

    const result = await createGift(headers, {
      title: "Книга",
      tags: [{ catalogId: "tag_dream" }],
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "tags" });
    expect(result).not.toHaveProperty("data");
  });

  /** Q-10/F4: a unique `GiftTag` index wins the race; there is no partial write. */
  it("maps a unique tag race during create to CONFLICT (P2002)", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    create.mockRejectedValue(
      new PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        meta: {
          modelName: "GiftTag",
          driverAdapterError: {
            cause: {
              kind: "UniqueConstraintViolation",
              table: "GiftTag",
              constraint: { index: "GiftTag_giftId_tagId_key" },
            },
          },
        },
      }),
    );

    const result = await createGift(headers, {
      title: "Книга",
      tags: [{ catalogId: "tag_dream" }],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: "Tags conflict with a concurrent change",
      field: "tags",
    });
    expect(result).not.toHaveProperty("data");
  });

  /** Only the tag relation is mapped: a vanished list stays a database failure. */
  it("rethrows a foreign key failure that names another relation", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    const error = new PrismaClientKnownRequestError("Foreign key constraint violated", {
      code: "P2003",
      // Same nested-create shape as the tag failure, but the adapter names Gift.listId.
      meta: {
        modelName: "Gift",
        driverAdapterError: {
          cause: {
            kind: "ForeignKeyConstraintViolation",
            constraint: { index: "Gift_listId_fkey" },
          },
        },
      },
    });
    create.mockRejectedValue(error);

    await expect(
      createGift(headers, { title: "Книга", tags: [{ catalogId: "tag_dream" }] }),
    ).rejects.toBe(error);
  });

  it("never lets the client set aggregate eligibility", async () => {
    expect(
      await createGift(headers, {
        title: "Книга",
        tags: [{ catalogId: "tag_dream", aggregateEligible: true }],
      }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects duplicate tags and over-long custom text before the database", async () => {
    for (const tags of [
      [{ catalogId: "tag_dream" }, { catalogId: "tag_dream" }],
      [{ text: "мечта" }, { text: " мечта " }],
      [{ text: "😀".repeat(31) }],
    ]) {
      expect(await createGift(headers, { title: "Книга", tags })).toMatchObject({
        ok: false,
        code: "VALIDATION",
      });
    }
    expect(create).not.toHaveBeenCalled();
    expect(tagFindMany).not.toHaveBeenCalled();
  });

  it("accepts 30 emoji as one code point each", async () => {
    create.mockResolvedValue(giftRow());
    const text = "😀".repeat(30);

    expect(await createGift(headers, { title: "Книга", tags: [{ text }] })).toMatchObject({
      ok: true,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: { create: [{ customText: text, aggregateEligible: false }] },
        }),
      }),
    );
  });

  it("preserves stored tags when an edit omits them", async () => {
    await updateGift(headers, "g1", { title: "Новое название" });

    expect(tagDeleteMany).not.toHaveBeenCalled();
    expect(tagCreateMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot() },
      data: { title: "Новое название" },
      select: { id: true },
    });
  });

  it("replaces the tag set atomically after the owned row is updated", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    txFindFirst
      .mockResolvedValueOnce(stored())
      .mockResolvedValueOnce(giftRow({ tags: [dreamRow, customRow] }));

    const card = okData(
      await updateGift(headers, "g1", {
        tags: [{ catalogId: "tag_dream" }, { text: "своё" }],
      }),
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot() },
      data: {},
      select: { id: true },
    });
    expect(tagDeleteMany).toHaveBeenCalledWith({ where: { giftId: "g1" } });
    expect(tagCreateMany).toHaveBeenCalledWith({
      data: [
        { tagId: "tag_dream", aggregateEligible: true, giftId: "g1" },
        { customText: "своё", aggregateEligible: false, giftId: "g1" },
      ],
    });
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(
      tagDeleteMany.mock.invocationCallOrder[0]!,
    );
    expect(card.tags).toEqual([
      { catalogId: null, label: "своё" },
      { catalogId: "tag_dream", label: "мечта" },
    ]);
  });

  /** Q-10/F4: the catalog row disappeared after the in-transaction check. */
  it("maps a catalog tag deleted during the tag replacement to VALIDATION (P2003)", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    tagCreateMany.mockRejectedValue(
      new PrismaClientKnownRequestError("Foreign key constraint violated", {
        code: "P2003",
        meta: {
          modelName: "GiftTag",
          driverAdapterError: {
            cause: {
              kind: "ForeignKeyConstraintViolation",
              constraint: { index: "GiftTag_tagId_fkey" },
            },
          },
        },
      }),
    );

    const result = await updateGift(headers, "g1", { tags: [{ catalogId: "tag_dream" }] });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "tags" });
    expect(result).not.toHaveProperty("data");
    // The transaction rolled the field write back; nothing partial is returned.
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(
      tagCreateMany.mock.invocationCallOrder[0]!,
    );
  });

  /** Q-10/F4: a concurrent replacement hit a `GiftTag` unique index. */
  it("maps a unique tag race during the tag replacement to CONFLICT (P2002)", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    tagCreateMany.mockRejectedValue(
      new PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        meta: {
          modelName: "GiftTag",
          driverAdapterError: {
            cause: {
              kind: "UniqueConstraintViolation",
              table: "GiftTag",
              constraint: { index: "GiftTag_giftId_customText_key" },
            },
          },
        },
      }),
    );

    const result = await updateGift(headers, "g1", { tags: [{ catalogId: "tag_dream" }] });

    expect(result).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: "Tags conflict with a concurrent change",
      field: "tags",
    });
    expect(result).not.toHaveProperty("data");
  });

  it("clears tags with an explicit empty list", async () => {
    txFindFirst.mockResolvedValueOnce(stored()).mockResolvedValueOnce(giftRow());

    const card = okData(await updateGift(headers, "g1", { tags: [] }));

    expect(tagDeleteMany).toHaveBeenCalledWith({ where: { giftId: "g1" } });
    expect(tagCreateMany).not.toHaveBeenCalled();
    expect(card.tags).toEqual([]);
  });

  it("rejects an unknown fixed tag id without deleting the stored tags", async () => {
    tagFindMany.mockResolvedValue([]);

    expect(
      await updateGift(headers, "g1", { tags: [{ catalogId: "tag_missing" }] }),
    ).toMatchObject({ ok: false, code: "VALIDATION", field: "tags" });
    expect(update).not.toHaveBeenCalled();
    expect(tagDeleteMany).not.toHaveBeenCalled();
    expect(tagCreateMany).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for another user's gift before touching its tags", async () => {
    txFindFirst.mockResolvedValueOnce(null);

    expect(await updateGift(headers, "g-other", { tags: [{ text: "своё" }] })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(tagDeleteMany).not.toHaveBeenCalled();
    expect(tagCreateMany).not.toHaveBeenCalled();
  });

  it("edits tags of a RESERVED wish, which AD-8 allows for gift fields", async () => {
    txFindFirst
      .mockResolvedValueOnce(stored({ status: "RESERVED" }))
      .mockResolvedValueOnce(giftRow({ status: "RESERVED", tags: [customRow] }));

    const card = okData(await updateGift(headers, "g1", { tags: [{ text: "своё" }] }));

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot("RESERVED") },
      data: {},
      select: { id: true },
    });
    expect(card.status).toBe("RESERVED");
    expect(card.tags).toEqual([{ catalogId: null, label: "своё" }]);
  });

  it("keeps the quantity and visibility gates unchanged when tags change too", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    txFindFirst
      .mockResolvedValueOnce(stored({ status: "OPEN", visibility: "PUBLIC" }))
      .mockResolvedValueOnce(giftRow({ visibility: "SECRET", tags: [dreamRow] }));

    const card = okData(
      await updateGift(headers, "g1", {
        visibility: "SECRET",
        tags: [{ catalogId: "tag_dream" }],
      }),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, ...snapshot() },
      data: { visibility: "SECRET" },
      select: { id: true },
    });
    expect(card.visibility).toBe("SECRET");
    expect(card.tags).toEqual([{ catalogId: "tag_dream", label: "мечта" }]);
  });

  /** A tag replacement on a reserved wish that also narrows visibility releases once, atomically. */
  it("releases the reservation once when a tag edit also narrows the visibility", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    txFindFirst
      .mockResolvedValueOnce(
        stored({ status: "RESERVED", visibility: "PUBLIC", reservedById: "u2" }),
      )
      .mockResolvedValueOnce(
        giftRow({ status: "OPEN", visibility: "SECRET", tags: [dreamRow] }),
      );

    const card = okData(
      await updateGift(headers, "g1", {
        visibility: "SECRET",
        tags: [{ catalogId: "tag_dream" }],
      }),
    );

    expect(releaseMany).toHaveBeenCalledTimes(1);
    expect(tagDeleteMany).toHaveBeenCalledWith({ where: { giftId: "g1" } });
    expect(card).toMatchObject({ status: "OPEN", visibility: "SECRET" });
  });
});

describe("deleteGift", () => {
  it("requires a session and does not touch the db", async () => {
    getSession.mockResolvedValue(null);

    expect(await deleteGift(headers, "g1")).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  /** Story 2.3: the delete carries ownership, "not archived" and the OPEN status. */
  it("deletes an OPEN wish of the owner's list", async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    expect(await deleteGift(headers, "g1")).toEqual({ ok: true, data: { id: "g1" } });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: "g1",
        archivedAt: null,
        status: "OPEN",
        list: { ownerId: "u1" },
      },
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  /** Story 2.3: RESERVED is Story 5.4 and CLOSED is Story 2.6, so both conflict here. */
  it.each(["RESERVED", "CLOSED"] as const)(
    "answers CONFLICT and keeps a %s wish",
    async (status) => {
      findFirst.mockResolvedValue({ status });

      expect(await deleteGift(headers, "g1")).toMatchObject({
        ok: false,
        code: "CONFLICT",
        message: "Only an open wish can be deleted here",
      });
    },
  );

  /** AD-7: a foreign, archived or missing gift answers one and the same NOT_FOUND. */
  it("answers NOT_FOUND for a foreign, archived or missing gift", async () => {
    findFirst.mockResolvedValue(null);

    expect(await deleteGift(headers, "g-other")).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});
