// CLE-143 (Story 10.1, AD-22): the server actions of `/admin`. Every action
// checks the ADMIN role itself, validates the body and turns the store answer
// into the AD-12 envelope — including the refusal to publish an empty collection.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requireAdmin,
  loadCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  publishCollection,
  unpublishCollection,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  revalidatePath,
} = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  loadCollection: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  publishCollection: vi.fn(),
  unpublishCollection: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  reorderItems: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async function requestHeaders() {
    return new Headers({ "x-test": "action" });
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

vi.mock("@/lib/admin", () => ({ requireAdmin }));

vi.mock("@/lib/editorial-store", () => ({
  getEditorialCollectionForAdmin: loadCollection,
  createEditorialCollection: createCollection,
  updateEditorialCollection: updateCollection,
  deleteEditorialCollection: deleteCollection,
  publishEditorialCollection: publishCollection,
  unpublishEditorialCollection: unpublishCollection,
  createEditorialItem: createItem,
  updateEditorialItem: updateItem,
  deleteEditorialItem: deleteItem,
  reorderEditorialItems: reorderItems,
}));

import {
  createCollectionAction,
  createItemAction,
  deleteCollectionAction,
  deleteItemAction,
  loadCollectionAction,
  publishCollectionAction,
  reorderItemsAction,
  unpublishCollectionAction,
  updateCollectionAction,
  updateItemAction,
} from "./editorial-admin";

const UPDATED = "2026-11-28T10:00:00.000Z";

const summary = {
  id: "c1",
  title: "Для рыбалки",
  description: null,
  coverImageUrl: null,
  itemCount: 1,
  publishedAt: "2026-11-28T09:00:00.000Z",
  updatedAt: UPDATED,
};

const item = {
  id: "i1",
  title: "Термос",
  description: null,
  linkUrl: null,
  imageUrl: null,
  position: 0,
};

const detail = { ...summary, items: [item] };

const collectionInput = { title: "Для рыбалки", description: "", coverImageUrl: "" };
// Empty optional inputs arrive as `""` and leave the schema as `null`.
const storedCollectionInput = { title: "Для рыбалки", description: null, coverImageUrl: null };
const itemInput = { title: "Термос", description: "", linkUrl: "", imageUrl: "" };
const storedItemInput = { title: "Термос", description: null, linkUrl: null, imageUrl: null };

beforeEach(() => {
  requireAdmin.mockReset();
  for (const mock of [
    loadCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    publishCollection,
    unpublishCollection,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    revalidatePath,
  ]) {
    mock.mockReset();
  }
  requireAdmin.mockResolvedValue({ ok: false });
});

/** Every exported action with a minimal valid call; the refusal must be the same. */
const ACTIONS: ReadonlyArray<{ name: string; call: () => Promise<{ ok: boolean; code?: string }> }> = [
  { name: "load", call: () => loadCollectionAction("c1") },
  { name: "create collection", call: () => createCollectionAction(collectionInput) },
  { name: "update collection", call: () => updateCollectionAction("c1", collectionInput) },
  { name: "delete collection", call: () => deleteCollectionAction("c1") },
  { name: "publish", call: () => publishCollectionAction("c1") },
  { name: "unpublish", call: () => unpublishCollectionAction("c1") },
  { name: "create item", call: () => createItemAction("c1", itemInput) },
  { name: "update item", call: () => updateItemAction("c1", "i1", itemInput) },
  { name: "delete item", call: () => deleteItemAction("c1", "i1") },
  { name: "reorder", call: () => reorderItemsAction("c1", ["i1"]) },
];

describe("the role gate of every action (AD-22)", () => {
  it.each(ACTIONS)("$name refuses a direct call from anonymous or USER", async ({ call }) => {
    await expect(call()).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
  });

  it("checks the role through the request headers and never writes on refusal", async () => {
    await createCollectionAction(collectionInput);

    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(createCollection).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("collections (Story 10.1)", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });
  });

  it("creates a draft and refreshes the table", async () => {
    createCollection.mockResolvedValue(detail);

    await expect(createCollectionAction(collectionInput)).resolves.toEqual({
      ok: true,
      data: detail,
    });
    expect(createCollection).toHaveBeenCalledWith(storedCollectionInput);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("rejects an empty title before the store and names the field", async () => {
    const result = await createCollectionAction({ title: "  " });

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
    expect(createCollection).not.toHaveBeenCalled();
  });

  it("rejects a non-http cover URL", async () => {
    const result = await createCollectionAction({
      title: "Для рыбалки",
      coverImageUrl: "ftp://example.com/cover.jpg",
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "coverImageUrl" });
  });

  it("edits a collection and answers its stored detail", async () => {
    updateCollection.mockResolvedValue(detail);

    await expect(updateCollectionAction("c1", collectionInput)).resolves.toEqual({
      ok: true,
      data: detail,
    });
    expect(updateCollection).toHaveBeenCalledWith("c1", storedCollectionInput);
  });

  it("answers a missing collection as not found", async () => {
    updateCollection.mockResolvedValue(null);

    await expect(updateCollectionAction("c9", collectionInput)).resolves.toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("loads one collection for the form", async () => {
    loadCollection.mockResolvedValue(detail);

    await expect(loadCollectionAction("c1")).resolves.toEqual({ ok: true, data: detail });
  });

  it("deletes a collection", async () => {
    deleteCollection.mockResolvedValue(true);

    await expect(deleteCollectionAction("c1")).resolves.toEqual({
      ok: true,
      data: { id: "c1" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("answers a delete of a gone collection as not found", async () => {
    deleteCollection.mockResolvedValue(false);

    await expect(deleteCollectionAction("c9")).resolves.toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("publication (Story 10.1)", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });
  });

  it("publishes a non-empty collection", async () => {
    publishCollection.mockResolvedValue({ ok: true, data: summary });

    await expect(publishCollectionAction("c1")).resolves.toEqual({ ok: true, data: summary });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("refuses an empty collection with the dedicated reason", async () => {
    publishCollection.mockResolvedValue({ ok: false, reason: "empty" });

    await expect(publishCollectionAction("c1")).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "COLLECTION_EMPTY",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("answers a missing collection on publish as not found", async () => {
    publishCollection.mockResolvedValue({ ok: false, reason: "not-found" });

    await expect(publishCollectionAction("c9")).resolves.toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("unpublishes a collection", async () => {
    unpublishCollection.mockResolvedValue({ ...summary, publishedAt: null });

    const result = await unpublishCollectionAction("c1");

    expect(result).toMatchObject({ ok: true, data: { publishedAt: null } });
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("answers an unknown collection on unpublish as not found", async () => {
    unpublishCollection.mockResolvedValue(null);

    await expect(unpublishCollectionAction("c9")).resolves.toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("ideas and their order (Story 10.1)", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });
  });

  it("adds an idea and answers the whole collection", async () => {
    createItem.mockResolvedValue(detail);

    await expect(createItemAction("c1", itemInput)).resolves.toEqual({ ok: true, data: detail });
    expect(createItem).toHaveBeenCalledWith("c1", storedItemInput);
  });

  it("rejects an idea with no title", async () => {
    const result = await createItemAction("c1", { title: "" });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "title" });
    expect(createItem).not.toHaveBeenCalled();
  });

  it("edits an idea of this collection", async () => {
    updateItem.mockResolvedValue(detail);

    await expect(updateItemAction("c1", "i1", itemInput)).resolves.toEqual({
      ok: true,
      data: detail,
    });
    expect(updateItem).toHaveBeenCalledWith("c1", "i1", storedItemInput);
  });

  it("answers a foreign idea as not found", async () => {
    updateItem.mockResolvedValue(null);

    await expect(updateItemAction("c1", "i9", itemInput)).resolves.toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("removes an idea and answers the remaining list", async () => {
    deleteItem.mockResolvedValue(true);
    loadCollection.mockResolvedValue({ ...detail, items: [], itemCount: 0 });

    await expect(deleteItemAction("c1", "i1")).resolves.toEqual({
      ok: true,
      data: { ...detail, items: [], itemCount: 0 },
    });
  });

  it("writes the new order of ideas", async () => {
    reorderItems.mockResolvedValue({ ok: true, data: detail });

    await expect(reorderItemsAction("c1", ["i1", "i2"])).resolves.toEqual({
      ok: true,
      data: detail,
    });
    expect(reorderItems).toHaveBeenCalledWith("c1", ["i1", "i2"]);
  });

  it("rejects a repeated idea in the order", async () => {
    const result = await reorderItemsAction("c1", ["i1", "i1"]);

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "itemIds" });
    expect(reorderItems).not.toHaveBeenCalled();
  });

  it("answers a stale order as validation, not a silent drop", async () => {
    reorderItems.mockResolvedValue({ ok: false, reason: "order" });

    await expect(reorderItemsAction("c1", ["i1"])).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "itemIds",
    });
  });
});
