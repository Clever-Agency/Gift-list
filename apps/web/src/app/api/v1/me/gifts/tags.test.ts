import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  findUnique,
  create,
  findFirst,
  txFindFirst,
  update,
  releaseMany,
  tagFindMany,
  tagDeleteMany,
  tagCreateMany,
  transaction,
  PrismaClientKnownRequestError,
} = vi.hoisted(() => {
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
    gift: { create, findFirst, update, updateMany: releaseMany },
    tag: { findMany: tagFindMany },
    giftTag: { deleteMany: tagDeleteMany, createMany: tagCreateMany },
    $transaction: transaction,
  },
}));
vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError } }));

type TagRow = { tagId: string | null; customText: string | null; tag: { slug: string; labels: unknown } | null };

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
  tags: TagRow[];
};

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
    tags: [],
    ...overrides,
  };
}

const dreamRow: TagRow = {
  tagId: "tag_dream",
  customText: null,
  tag: { slug: "dream", labels: { ru: "мечта" } },
};
const customRow: TagRow = { tagId: null, customText: "своё", tag: null };

function post(body: unknown) {
  return new Request("http://x/api/v1/me/gifts", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

function patch(body: unknown) {
  return new Request("http://x/api/v1/me/gifts/g1", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: "g1" }) };

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  create.mockReset();
  findFirst.mockReset();
  txFindFirst.mockReset();
  update.mockReset();
  releaseMany.mockReset();
  tagFindMany.mockReset();
  tagDeleteMany.mockReset();
  tagCreateMany.mockReset();
  transaction.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1" });
  create.mockResolvedValue(giftRow());
  findFirst.mockResolvedValue(null);
  txFindFirst.mockResolvedValue(giftRow());
  update.mockResolvedValue({ id: "g1" });
  releaseMany.mockResolvedValue({ count: 1 });
  tagFindMany.mockResolvedValue([]);
  tagDeleteMany.mockResolvedValue({ count: 0 });
  tagCreateMany.mockResolvedValue({ count: 0 });
  transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        gift: { findFirst: txFindFirst, update, updateMany: releaseMany },
        tag: { findMany: tagFindMany },
        giftTag: { deleteMany: tagDeleteMany, createMany: tagCreateMany },
      }),
  );
});

describe("POST /api/v1/me/gifts tags", () => {
  it("creates fixed and custom tags and returns them on the card", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    create.mockResolvedValue(giftRow({ tags: [dreamRow, customRow] }));

    const { POST } = await import("./route");
    const res = await POST(
      post({ title: "Книга", tags: [{ catalogId: "tag_dream" }, { text: "своё" }] }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
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
    expect(body.data.tags).toEqual([
      { catalogId: null, label: "своё" },
      { catalogId: "tag_dream", label: "мечта" },
    ]);
  });

  it("answers 400 and writes no gift when a fixed tag id is unknown", async () => {
    tagFindMany.mockResolvedValue([]);

    const { POST } = await import("./route");
    const res = await POST(post({ title: "Книга", tags: [{ catalogId: "tag_missing" }] }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "tags.0.catalogId",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("answers 400 when the body tries to set aggregate eligibility", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      post({ title: "Книга", tags: [{ catalogId: "tag_dream", aggregateEligible: true }] }),
    );

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("answers 400 with the tags field for a duplicate tag", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      post({ title: "Книга", tags: [{ text: "своё" }, { text: " своё " }] }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "tags",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("answers 400 for over-long custom text without calling the use-case write", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ title: "Книга", tags: [{ text: "😀".repeat(31) }] }));

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION");
    expect(create).not.toHaveBeenCalled();
  });

  /** Q-10/F4: a catalog row deleted after the check is invalid input, not a 500. */
  it("answers 400 in the envelope when the catalog tag races the insert (P2003)", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    create.mockRejectedValue(
      new PrismaClientKnownRequestError("Foreign key constraint violated", {
        code: "P2003",
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

    const { POST } = await import("./route");
    const res = await POST(post({ title: "Книга", tags: [{ catalogId: "tag_dream" }] }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "tags",
    });
  });

  /** Q-10/F4: the gift's own list FK is not a tag failure and stays unhandled. */
  it("does not turn a Gift.listId foreign key into a tags envelope", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    const error = new PrismaClientKnownRequestError("Foreign key constraint violated", {
      code: "P2003",
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

    const { POST } = await import("./route");

    await expect(
      POST(post({ title: "Книга", tags: [{ catalogId: "tag_dream" }] })),
    ).rejects.toBe(error);
  });

  it("answers 409 in the envelope when a unique tag index loses the race (P2002)", async () => {
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

    const { POST } = await import("./route");
    const res = await POST(post({ title: "Книга", tags: [{ catalogId: "tag_dream" }] }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Tags conflict with a concurrent change",
      field: "tags",
    });
  });
});

describe("PATCH /api/v1/me/gifts/[id] tags", () => {
  const stored = {
    priceAmount: null,
    priceCurrency: null,
    status: "OPEN" as const,
    visibility: "PUBLIC" as const,
    quantity: "SINGLE" as const,
    archivedAt: null,
    reservedById: null,
  };

  it("keeps the stored tags when the body omits them", async () => {
    txFindFirst
      .mockResolvedValueOnce(stored)
      .mockResolvedValueOnce(giftRow({ title: "Новое название", tags: [dreamRow] }));

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(patch({ title: "Новое название" }), context);

    expect(res.status).toBe(200);
    expect(tagDeleteMany).not.toHaveBeenCalled();
    expect(tagCreateMany).not.toHaveBeenCalled();
    expect((await res.json()).data.tags).toEqual([{ catalogId: "tag_dream", label: "мечта" }]);
  });

  it("replaces the tag set in one transaction", async () => {
    tagFindMany.mockResolvedValue([{ id: "tag_dream" }]);
    txFindFirst
      .mockResolvedValueOnce(stored)
      .mockResolvedValueOnce(giftRow({ tags: [dreamRow, customRow] }));

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(
      patch({ tags: [{ catalogId: "tag_dream" }, { text: "своё" }] }),
      context,
    );

    expect(res.status).toBe(200);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tagDeleteMany).toHaveBeenCalledWith({ where: { giftId: "g1" } });
    expect(tagCreateMany).toHaveBeenCalledWith({
      data: [
        { tagId: "tag_dream", aggregateEligible: true, giftId: "g1" },
        { customText: "своё", aggregateEligible: false, giftId: "g1" },
      ],
    });
    expect((await res.json()).data.tags).toEqual([
      { catalogId: null, label: "своё" },
      { catalogId: "tag_dream", label: "мечта" },
    ]);
  });

  it("clears the tags with an explicit empty list", async () => {
    txFindFirst.mockResolvedValueOnce(stored).mockResolvedValueOnce(giftRow());

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(patch({ tags: [] }), context);

    expect(res.status).toBe(200);
    expect(tagDeleteMany).toHaveBeenCalledWith({ where: { giftId: "g1" } });
    expect(tagCreateMany).not.toHaveBeenCalled();
    expect((await res.json()).data.tags).toEqual([]);
  });

  it("answers 400 and touches no tag when a fixed tag id is unknown", async () => {
    tagFindMany.mockResolvedValue([]);
    txFindFirst.mockResolvedValueOnce(stored);

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(patch({ tags: [{ catalogId: "tag_missing" }] }), context);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "tags.0.catalogId",
    });
    expect(update).not.toHaveBeenCalled();
    expect(tagDeleteMany).not.toHaveBeenCalled();
  });

  it("answers 404 for another user's gift without writing tags", async () => {
    txFindFirst.mockResolvedValueOnce(null);

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(patch({ tags: [{ text: "своё" }] }), context);

    expect(res.status).toBe(404);
    expect(tagDeleteMany).not.toHaveBeenCalled();
    expect(tagCreateMany).not.toHaveBeenCalled();
  });

  /** Q-10/F4: the tag replacement rolls back and answers VALIDATION, not a 500. */
  it("answers 400 in the envelope when the catalog tag races the replacement (P2003)", async () => {
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

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(patch({ tags: [{ catalogId: "tag_dream" }] }), context);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "tags",
    });
  });

  it("answers 409 in the envelope when a unique tag index loses the race (P2002)", async () => {
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
              constraint: { index: "GiftTag_giftId_tagId_key" },
            },
          },
        },
      }),
    );

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(patch({ tags: [{ catalogId: "tag_dream" }] }), context);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Tags conflict with a concurrent change",
      field: "tags",
    });
  });
});
