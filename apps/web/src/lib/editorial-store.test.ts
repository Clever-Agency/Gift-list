// CLE-143 (Story 10.1, AD-22): the editorial store — admin CRUD, publication and
// the two app reads, on mocked Prisma.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  transaction,
  executeRaw,
  collectionFindMany,
  collectionFindUnique,
  collectionFindFirst,
  collectionCreate,
  collectionUpdateMany,
  collectionUpdate,
  collectionDeleteMany,
  itemFindFirst,
  itemFindMany,
  itemCreate,
  itemUpdateMany,
  itemDeleteMany,
  itemCount,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  collectionFindMany: vi.fn(),
  collectionFindUnique: vi.fn(),
  collectionFindFirst: vi.fn(),
  collectionCreate: vi.fn(),
  collectionUpdateMany: vi.fn(),
  collectionUpdate: vi.fn(),
  collectionDeleteMany: vi.fn(),
  itemFindFirst: vi.fn(),
  itemFindMany: vi.fn(),
  itemCreate: vi.fn(),
  itemUpdateMany: vi.fn(),
  itemDeleteMany: vi.fn(),
  itemCount: vi.fn(),
}));

const tx = {
  $executeRaw: executeRaw,
  editorialCollection: {
    findUnique: collectionFindUnique,
    update: collectionUpdate,
  },
  editorialItem: {
    findFirst: itemFindFirst,
    findMany: itemFindMany,
    create: itemCreate,
    updateMany: itemUpdateMany,
    count: itemCount,
  },
};

vi.mock("@/db/client", () => ({
  prisma: {
    $transaction: transaction,
    editorialCollection: {
      findMany: collectionFindMany,
      findUnique: collectionFindUnique,
      findFirst: collectionFindFirst,
      create: collectionCreate,
      updateMany: collectionUpdateMany,
      deleteMany: collectionDeleteMany,
    },
    editorialItem: {
      findFirst: itemFindFirst,
      findMany: itemFindMany,
      create: itemCreate,
      updateMany: itemUpdateMany,
      deleteMany: itemDeleteMany,
      count: itemCount,
    },
  },
}));

import {
  createEditorialItem,
  getPublishedEditorialCollection,
  listEditorialCollectionsForAdmin,
  listPublishedEditorialCollections,
  publishEditorialCollection,
  reorderEditorialItems,
  unpublishEditorialCollection,
  updateEditorialCollection,
} from "./editorial-store";

const NOW = new Date("2026-11-28T00:00:00.000Z");

const ideaRows = [
  {
    id: "i1",
    title: "Термос",
    description: null,
    linkUrl: null,
    imageUrl: null,
    position: 0,
  },
  {
    id: "i2",
    title: "Спиннинг",
    description: null,
    linkUrl: "https://example.com/spinning",
    imageUrl: null,
    position: 1,
  },
];

const publishedRow = {
  id: "c1",
  title: "Для рыбалки",
  description: null,
  coverImageUrl: null,
  publishedAt: new Date("2026-11-01T00:00:00.000Z"),
  _count: { items: 2 },
  items: ideaRows,
};

beforeEach(() => {
  for (const mock of [
    transaction,
    executeRaw,
    collectionFindMany,
    collectionFindUnique,
    collectionFindFirst,
    collectionCreate,
    collectionUpdateMany,
    collectionUpdate,
    collectionDeleteMany,
    itemFindFirst,
    itemFindMany,
    itemCreate,
    itemUpdateMany,
    itemDeleteMany,
    itemCount,
  ]) {
    mock.mockReset();
  }

  transaction.mockImplementation(
    async function runInTransaction(work: (client: typeof tx) => Promise<unknown>) {
      return work(tx);
    },
  );
  executeRaw.mockResolvedValue(0);
  collectionFindMany.mockResolvedValue([]);
  collectionFindUnique.mockResolvedValue(null);
  collectionFindFirst.mockResolvedValue(null);
  collectionUpdateMany.mockResolvedValue({ count: 1 });
  collectionDeleteMany.mockResolvedValue({ count: 1 });
  itemFindFirst.mockResolvedValue(null);
  itemFindMany.mockResolvedValue([]);
  itemCreate.mockResolvedValue({ id: "i9" });
  itemUpdateMany.mockResolvedValue({ count: 1 });
  itemDeleteMany.mockResolvedValue({ count: 1 });
  itemCount.mockResolvedValue(0);
});

describe("admin list (Story 10.1)", () => {
  it("maps the item count and keeps the publication state", async () => {
    collectionFindMany.mockResolvedValue([publishedRow]);

    await expect(listEditorialCollectionsForAdmin()).resolves.toEqual([
      {
        id: "c1",
        title: "Для рыбалки",
        description: null,
        coverImageUrl: null,
        itemCount: 2,
        publishedAt: "2026-11-01T00:00:00.000Z",
      },
    ]);
    expect(collectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ _count: { select: { items: true } } }),
      }),
    );
  });
});

describe("publishing (Story 10.1)", () => {
  it("refuses an empty collection and does not write the stamp", async () => {
    collectionFindUnique.mockResolvedValue({ id: "c1" });
    itemCount.mockResolvedValue(0);

    await expect(publishEditorialCollection("c1")).resolves.toEqual({
      ok: false,
      reason: "empty",
    });
    expect(collectionUpdate).not.toHaveBeenCalled();
  });

  it("stamps a non-empty collection and answers its row", async () => {
    collectionFindUnique.mockResolvedValue({ id: "c1" });
    itemCount.mockResolvedValue(2);
    collectionUpdate.mockResolvedValue(publishedRow);

    const result = await publishEditorialCollection("c1");

    expect(result).toEqual({
      ok: true,
      data: {
        id: "c1",
        title: "Для рыбалки",
        description: null,
        coverImageUrl: null,
        itemCount: 2,
        publishedAt: "2026-11-01T00:00:00.000Z",
      },
    });
    const update = collectionUpdate.mock.calls[0]?.[0] as {
      data: { publishedAt: Date };
    };
    expect(update.data.publishedAt).toBeInstanceOf(Date);
  });

  it("answers a missing collection as not found", async () => {
    collectionFindUnique.mockResolvedValue(null);

    await expect(publishEditorialCollection("c1")).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("clears the stamp on unpublish", async () => {
    collectionFindUnique.mockResolvedValue({ ...publishedRow, publishedAt: null });

    const result = await unpublishEditorialCollection("c1");

    expect(collectionUpdateMany).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { publishedAt: null },
    });
    expect(result?.publishedAt).toBeNull();
  });

  it("answers an unknown collection on unpublish with null", async () => {
    collectionUpdateMany.mockResolvedValue({ count: 0 });

    await expect(unpublishEditorialCollection("c1")).resolves.toBeNull();
  });
});

describe("editing (Story 10.1)", () => {
  it("clears an absent description and cover", async () => {
    collectionFindUnique.mockResolvedValue({ ...publishedRow, items: [] });
    collectionUpdateMany.mockResolvedValue({ count: 1 });

    await updateEditorialCollection("c1", { title: "Для рыбалки" });

    expect(collectionUpdateMany).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { title: "Для рыбалки", description: null, coverImageUrl: null },
    });
  });

  it("answers a foreign collection as not found", async () => {
    collectionUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateEditorialCollection("c9", { title: "Чужая" }),
    ).resolves.toBeNull();
  });
});

describe("idea order (Story 10.1)", () => {
  it("appends a new idea after the stored last position", async () => {
    collectionFindUnique.mockResolvedValue(publishedRow);
    itemFindFirst.mockResolvedValue({ position: 4 });

    await createEditorialItem("c1", { title: "Фонарь" });

    const create = itemCreate.mock.calls[0]?.[0] as {
      data: { position: number; collectionId: string; title: string };
    };
    expect(create.data).toMatchObject({ collectionId: "c1", title: "Фонарь", position: 5 });
  });

  it("puts the first idea at position 0", async () => {
    collectionFindUnique.mockResolvedValue({ ...publishedRow, items: [] });
    itemFindFirst.mockResolvedValue(null);

    await createEditorialItem("c1", { title: "Фонарь" });

    const create = itemCreate.mock.calls[0]?.[0] as { data: { position: number } };
    expect(create.data.position).toBe(0);
  });

  it("does not add an idea to a missing collection", async () => {
    collectionFindUnique.mockResolvedValue(null);

    await expect(createEditorialItem("c9", { title: "Фонарь" })).resolves.toBeNull();
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it("writes the requested order as 0..n-1", async () => {
    collectionFindUnique.mockResolvedValue(publishedRow);
    itemFindMany.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);

    const result = await reorderEditorialItems("c1", ["i2", "i1"]);

    expect(result.ok).toBe(true);
    const writes = itemUpdateMany.mock.calls.map(function toArg(call) {
      return call[0] as { where: { id: string }; data: { position: number } };
    });
    expect(writes).toEqual([
      { where: { id: "i2", collectionId: "c1" }, data: { position: 0 } },
      { where: { id: "i1", collectionId: "c1" }, data: { position: 1 } },
    ]);
  });

  it("refuses an order that is not exactly the stored set", async () => {
    collectionFindUnique.mockResolvedValue(publishedRow);
    itemFindMany.mockResolvedValue([{ id: "i1" }, { id: "i2" }]);

    await expect(reorderEditorialItems("c1", ["i1"])).resolves.toEqual({
      ok: false,
      reason: "order",
    });
    expect(itemUpdateMany).not.toHaveBeenCalled();
  });

  it("answers a missing collection on reorder as not found", async () => {
    collectionFindUnique.mockResolvedValue(null);

    await expect(reorderEditorialItems("c9", ["i1"])).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});

describe("app reads (Story 10.1)", () => {
  it("lists only published collections, newest publication first", async () => {
    collectionFindMany.mockResolvedValue([publishedRow]);

    await expect(listPublishedEditorialCollections(NOW)).resolves.toEqual([
      {
        id: "c1",
        title: "Для рыбалки",
        description: null,
        coverImageUrl: null,
        itemCount: 2,
      },
    ]);
    expect(collectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publishedAt: { not: null, lte: NOW } },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("asks for one published collection", async () => {
    collectionFindFirst.mockResolvedValue(publishedRow);

    const detail = await getPublishedEditorialCollection("c1", NOW);

    expect(detail?.items.map((row) => row.id)).toEqual(["i1", "i2"]);
    expect(detail?.items[0]).not.toHaveProperty("position");
    expect(collectionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1", publishedAt: { not: null, lte: NOW } },
      }),
    );
  });

  it("answers a draft with null even if a query returned it", async () => {
    collectionFindFirst.mockResolvedValue({ ...publishedRow, publishedAt: null });

    await expect(getPublishedEditorialCollection("c1", NOW)).resolves.toBeNull();
  });

  it("answers a missing collection with null", async () => {
    collectionFindFirst.mockResolvedValue(null);

    await expect(getPublishedEditorialCollection("c9", NOW)).resolves.toBeNull();
  });
});
