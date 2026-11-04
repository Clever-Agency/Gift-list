import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, create, findFirst, update, PrismaClientKnownRequestError } =
  vi.hoisted(() => {
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
      PrismaClientKnownRequestError,
    };
  });

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: { list: { findUnique }, gift: { create, findFirst, update } },
}));
vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError } }));

import { giftCardSchema } from "@gift-list/contracts";

import { createGift, getGift, updateGift } from "./gifts";

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
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1" });
  create.mockResolvedValue(giftRow());
  findFirst.mockResolvedValue(null);
  update.mockResolvedValue(giftRow());
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
        status: "OPEN",
      },
      select: expect.any(Object),
    });
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
      select: { priceAmount: true },
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
});
