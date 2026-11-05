import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  findUnique,
  create,
  findFirst,
  update,
  deleteMany,
  tagFindMany,
  tagDeleteMany,
  tagCreateMany,
  transaction,
  PrismaClientKnownRequestError,
} = vi.hoisted(() => {
    /** Stands in for the generated class, so a test can shape the `code` the use-cases read. */
    class PrismaClientKnownRequestError extends Error {
      code: string;

      constructor(message: string, { code }: { code: string }) {
        super(message);
        this.code = code;
      }
    }

    return {
      getSession: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      tagFindMany: vi.fn(),
      tagDeleteMany: vi.fn(),
      tagCreateMany: vi.fn(),
      transaction: vi.fn(),
      PrismaClientKnownRequestError,
    };
  });

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    list: { findUnique },
    gift: { create, findFirst, update, deleteMany },
    tag: { findMany: tagFindMany },
    giftTag: { deleteMany: tagDeleteMany, createMany: tagCreateMany },
    $transaction: transaction,
  },
}));
vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError } }));

import { giftCardSchema } from "@gift-list/contracts";

import { createGift, deleteGift, getGift, updateGift } from "./gifts";

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
    list: { ownerId: "u1" },
    tags: [],
    ...overrides,
  };
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
  update.mockReset();
  deleteMany.mockReset();
  tagFindMany.mockReset();
  tagDeleteMany.mockReset();
  tagCreateMany.mockReset();
  transaction.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1" });
  create.mockResolvedValue(giftRow());
  findFirst.mockResolvedValue(null);
  update.mockResolvedValue(giftRow());
  deleteMany.mockResolvedValue({ count: 0 });
  tagFindMany.mockResolvedValue([]);
  tagDeleteMany.mockResolvedValue({ count: 0 });
  tagCreateMany.mockResolvedValue({ count: 0 });
  // A stand-in for an interactive transaction: it runs the callback with the
  // same mocked delegates, so the test sees the order of the writes.
  transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        gift: { update, findFirst },
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
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: null, label: "своё" },
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
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  /** An empty body trips the schema's "at least one field" refine, which carries no path. */
  it("rejects an empty body without touching the db", async () => {
    const result = await updateGift(headers, "g1", {});

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(result).not.toHaveProperty("field");
    expect(findFirst).not.toHaveBeenCalled();
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

  /**
   * The strict object rejects the key, but zod attaches `unrecognized_keys` to the
   * object itself, so the envelope names no field — the same shape `createGift`
   * answers for a smuggled `ownerId`.
   */
  it("rejects an unknown key instead of writing it", async () => {
    const result = await updateGift(headers, "g1", { title: "Книга", ownerId: "u2" });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(result).not.toHaveProperty("field");
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * AD-6/AD-8: the gift id comes from the caller, but ownership and "not
   * archived" ride in the write's `where`, so a foreign or archived gift matches
   * nothing. The body only carries the keys that came in.
   */
  it("writes through the owner gate and sends only the provided keys", async () => {
    getSession.mockResolvedValue({ user: { id: "u2" }, session: { token: "t" } });

    await updateGift(headers, "g7", { title: "Новое название" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "g7", archivedAt: null, list: { ownerId: "u2" } },
      data: { title: "Новое название" },
      select: expect.any(Object),
    });
  });

  /** AD-25/FR-10: `null` clears a field; a cleared amount clears the currency with it. */
  it("clears description, link and price when `null` comes in", async () => {
    await updateGift(headers, "g1", { description: null, linkUrl: null, priceAmount: null });

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" } },
      data: { description: null, linkUrl: null, priceAmount: null, priceCurrency: null },
      select: expect.any(Object),
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("prices an amount without a currency as USD", async () => {
    await updateGift(headers, "g1", { priceAmount: 1250 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceAmount: 1250, priceCurrency: "USD" } }),
    );
    // The contract already pairs amount and currency, so no stored read is needed.
    expect(findFirst).not.toHaveBeenCalled();
  });

  /** AD-25: a currency alone keeps the stored amount, so the amount is read first. */
  it("keeps the stored amount when only a currency comes in", async () => {
    findFirst.mockResolvedValue({ priceAmount: 5000 });

    await updateGift(headers, "g1", { priceCurrency: "EUR" });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" } },
      select: { priceAmount: true, status: true, visibility: true, quantity: true },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceCurrency: "EUR" } }),
    );
  });

  it("drops a currency that has no stored amount to price", async () => {
    findFirst.mockResolvedValue({ priceAmount: null });

    await updateGift(headers, "g1", { priceCurrency: "EUR" });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { priceCurrency: null } }),
    );
  });

  it("answers NOT_FOUND without writing when the gift is not the owner's", async () => {
    findFirst.mockResolvedValue(null);

    expect(await updateGift(headers, "g-other", { priceCurrency: "EUR" })).toMatchObject({
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
    update.mockResolvedValue(
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
    findFirst.mockResolvedValue({ priceAmount: null, status: "OPEN", visibility: "PUBLIC" });
    update.mockResolvedValue(giftRow({ visibility: "SECRET" }));

    const card = okData(await updateGift(headers, "g1", { visibility: "SECRET" }));

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" }, status: "OPEN" },
      data: { visibility: "SECRET" },
      select: expect.any(Object),
    });
    expect(card).toMatchObject({ visibility: "SECRET" });
  });

  /** Story 2.3/AD-8: a reserved wish rejects a new visibility and writes nothing. */
  it.each(["RESERVED", "CLOSED"] as const)(
    "answers VALIDATION when changing the visibility of a %s wish",
    async (status) => {
      findFirst.mockResolvedValue({ priceAmount: null, status, visibility: "PUBLIC" });

      expect(await updateGift(headers, "g1", { visibility: "FRIENDS" })).toMatchObject({
        ok: false,
        code: "VALIDATION",
        message: "Invalid input",
        field: "visibility",
      });
      expect(update).not.toHaveBeenCalled();
    },
  );

  /** The reserved wish's form resends the stored value; that is not a change. */
  it("ignores an unchanged visibility and still saves the other fields", async () => {
    findFirst.mockResolvedValue({ priceAmount: null, status: "RESERVED", visibility: "PUBLIC" });
    update.mockResolvedValue(giftRow({ title: "Новое название", status: "RESERVED" }));

    const card = okData(
      await updateGift(headers, "g1", { title: "Новое название", visibility: "PUBLIC" }),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" } },
      data: { title: "Новое название" },
      select: expect.any(Object),
    });
    expect(card.title).toBe("Новое название");
  });

  /** AD-8: the write's `status: "OPEN"` loses to a reservation made after the read. */
  it("answers VALIDATION when the wish is reserved before the guarded write lands", async () => {
    findFirst
      .mockResolvedValueOnce({ priceAmount: null, status: "OPEN", visibility: "PUBLIC" })
      .mockResolvedValueOnce({ status: "RESERVED" });
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );

    expect(await updateGift(headers, "g1", { visibility: "SECRET" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "visibility",
    });
  });

  /** The guarded write can also lose to an archive or a foreign list: NOT_FOUND. */
  it("answers NOT_FOUND when the guarded write finds no owned row", async () => {
    findFirst
      .mockResolvedValueOnce({ priceAmount: null, status: "OPEN", visibility: "PUBLIC" })
      .mockResolvedValueOnce(null);
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );

    expect(await updateGift(headers, "g1", { visibility: "SECRET" })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("answers NOT_FOUND without writing when a visibility change targets a foreign gift", async () => {
    findFirst.mockResolvedValue(null);

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
    findFirst.mockResolvedValue({
      priceAmount: null,
      status: "OPEN",
      visibility: "PUBLIC",
      quantity: "SINGLE",
    });
    update.mockResolvedValue(giftRow({ quantity: "UNLIMITED" }));

    const card = okData(await updateGift(headers, "g1", { quantity: "UNLIMITED" }));

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" }, status: "OPEN" },
      data: { quantity: "UNLIMITED" },
      select: expect.any(Object),
    });
    expect(card.quantity).toBe("UNLIMITED");
  });

  it("writes quantity and visibility together on an OPEN wish", async () => {
    findFirst.mockResolvedValue({
      priceAmount: null,
      status: "OPEN",
      visibility: "PUBLIC",
      quantity: "SINGLE",
    });
    update.mockResolvedValue(giftRow({ quantity: "UNLIMITED", visibility: "SECRET" }));

    await updateGift(headers, "g1", { quantity: "UNLIMITED", visibility: "SECRET" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" }, status: "OPEN" },
      data: { quantity: "UNLIMITED", visibility: "SECRET" },
      select: expect.any(Object),
    });
  });

  /** Story 2.5/AD-8: a reserved or closed wish keeps its quantity. */
  it.each(["RESERVED", "CLOSED"] as const)(
    "answers VALIDATION when changing the quantity of a %s wish",
    async (status) => {
      findFirst.mockResolvedValue({
        priceAmount: null,
        status,
        visibility: "PUBLIC",
        quantity: "SINGLE",
      });

      expect(await updateGift(headers, "g1", { quantity: "UNLIMITED" })).toMatchObject({
        ok: false,
        code: "VALIDATION",
        message: "Invalid input",
        field: "quantity",
      });
      expect(update).not.toHaveBeenCalled();
    },
  );

  /** A reserved wish's form resends the stored quantity; that is not a change. */
  it("ignores an unchanged quantity and still saves the other fields", async () => {
    findFirst.mockResolvedValue({
      priceAmount: null,
      status: "RESERVED",
      visibility: "PUBLIC",
      quantity: "UNLIMITED",
    });
    update.mockResolvedValue(
      giftRow({ title: "Новое название", status: "RESERVED", quantity: "UNLIMITED" }),
    );

    const card = okData(
      await updateGift(headers, "g1", { title: "Новое название", quantity: "UNLIMITED" }),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" } },
      data: { title: "Новое название" },
      select: expect.any(Object),
    });
    expect(card.title).toBe("Новое название");
  });

  /** Story 2.3 is untouched: a resent quantity does not soften the visibility rule. */
  it("keeps a RESERVED wish's visibility rule when quantity is resent unchanged", async () => {
    findFirst.mockResolvedValue({
      priceAmount: null,
      status: "RESERVED",
      visibility: "PUBLIC",
      quantity: "SINGLE",
    });

    expect(
      await updateGift(headers, "g1", { quantity: "SINGLE", visibility: "SECRET" }),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "visibility",
    });
    expect(update).not.toHaveBeenCalled();
  });

  /** Both guarded fields change on a non-OPEN wish: the visibility rule reports first. */
  it("names visibility when both quantity and visibility change on a RESERVED wish", async () => {
    findFirst.mockResolvedValue({
      priceAmount: null,
      status: "RESERVED",
      visibility: "PUBLIC",
      quantity: "SINGLE",
    });

    expect(
      await updateGift(headers, "g1", { quantity: "UNLIMITED", visibility: "SECRET" }),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "visibility",
    });
    expect(update).not.toHaveBeenCalled();
  });

  /** AD-8: the write's `status: "OPEN"` loses to a reservation made after the read. */
  it("answers VALIDATION when the wish is reserved before the guarded quantity write lands", async () => {
    findFirst
      .mockResolvedValueOnce({
        priceAmount: null,
        status: "OPEN",
        visibility: "PUBLIC",
        quantity: "SINGLE",
      })
      .mockResolvedValueOnce({ status: "RESERVED" });
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );

    expect(await updateGift(headers, "g1", { quantity: "UNLIMITED" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "quantity",
    });
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
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: null, label: "своё" },
    ]);
  });

  it("creates no tags when the body has none", async () => {
    await createGift(headers, { title: "Книга" });

    expect(tagFindMany).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ data: expect.objectContaining({ tags: expect.anything() }) }),
    );
  });

  it("returns card tags in catalog order regardless of the stored row order", async () => {
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
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: "tag_need_now", label: "нужно сейчас" },
      { catalogId: "tag_someday", label: "когда-нибудь" },
      { catalogId: null, label: "своё" },
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

    expect(transaction).not.toHaveBeenCalled();
    expect(tagDeleteMany).not.toHaveBeenCalled();
    expect(tagCreateMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" } },
      data: { title: "Новое название" },
      select: expect.any(Object),
    });
  });

  it("replaces the tag set atomically after the owned row is updated", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    update.mockResolvedValue({ id: "g1" });
    findFirst.mockResolvedValue(giftRow({ tags: [dreamRow, customRow] }));

    const card = okData(
      await updateGift(headers, "g1", {
        tags: [{ catalogId: "tag_dream" }, { text: "своё" }],
      }),
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" } },
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
      { catalogId: "tag_dream", label: "мечта" },
      { catalogId: null, label: "своё" },
    ]);
  });

  it("clears tags with an explicit empty list", async () => {
    update.mockResolvedValue({ id: "g1" });
    findFirst.mockResolvedValue(giftRow());

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
    update.mockRejectedValue(
      new PrismaClientKnownRequestError("Record to update not found.", { code: "P2025" }),
    );

    expect(await updateGift(headers, "g-other", { tags: [{ text: "своё" }] })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(tagDeleteMany).not.toHaveBeenCalled();
    expect(tagCreateMany).not.toHaveBeenCalled();
  });

  it("edits tags of a RESERVED wish, which AD-8 allows for gift fields", async () => {
    update.mockResolvedValue({ id: "g1" });
    findFirst.mockResolvedValue(giftRow({ status: "RESERVED", tags: [customRow] }));

    const card = okData(await updateGift(headers, "g1", { tags: [{ text: "своё" }] }));

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" } },
      data: {},
      select: { id: true },
    });
    expect(card.status).toBe("RESERVED");
    expect(card.tags).toEqual([{ catalogId: null, label: "своё" }]);
  });

  it("keeps the quantity and visibility gates unchanged when tags change too", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    findFirst
      .mockResolvedValueOnce({
        priceAmount: null,
        status: "OPEN",
        visibility: "PUBLIC",
        quantity: "SINGLE",
      })
      .mockResolvedValueOnce(giftRow({ visibility: "SECRET", tags: [dreamRow] }));
    update.mockResolvedValue({ id: "g1" });

    const card = okData(
      await updateGift(headers, "g1", {
        visibility: "SECRET",
        tags: [{ catalogId: "tag_dream" }],
      }),
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" }, status: "OPEN" },
      data: { visibility: "SECRET" },
      select: { id: true },
    });
    expect(card.visibility).toBe("SECRET");
    expect(card.tags).toEqual([{ catalogId: "tag_dream", label: "мечта" }]);
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
