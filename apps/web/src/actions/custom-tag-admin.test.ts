// CLE-144 (Story 10.2, AD-22): the server actions of `/admin/tags`. Every action
// checks the ADMIN role itself, validates the body with the contracts and turns
// the store outcome into the AD-12 envelope.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requireAdmin, approve, reject, revalidatePath } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async function requestHeaders() {
    return new Headers({ "x-test": "action" });
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/admin", () => ({ requireAdmin }));
vi.mock("@/lib/custom-tag-store", () => ({
  approveCustomTag: approve,
  rejectCustomTag: reject,
}));

import { approveCustomTagAction, rejectCustomTagAction } from "./custom-tag-admin";

const newTagInput = {
  mode: "new",
  normalizedText: "айфон",
  slug: "iphone",
  labels: { ru: "Айфон" },
};

const existingTagInput = {
  mode: "existing",
  normalizedText: "айфон",
  tagId: "t1",
};

beforeEach(() => {
  requireAdmin.mockReset();
  approve.mockReset();
  reject.mockReset();
  revalidatePath.mockReset();
  requireAdmin.mockResolvedValue({ ok: false });
});

/** Both exported actions with a valid call; a refusal must be the same. */
const ACTIONS: ReadonlyArray<{ name: string; call: () => Promise<{ ok: boolean; code?: string }> }> = [
  { name: "approve", call: () => approveCustomTagAction(newTagInput) },
  { name: "reject", call: () => rejectCustomTagAction({ normalizedText: "айфон" }) },
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
    await approveCustomTagAction(newTagInput);

    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(approve).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("approval through a new catalog tag (Story 10.2)", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });
  });

  it("passes the validated body to the store and refreshes the queue", async () => {
    approve.mockResolvedValue({ ok: true, tagId: "t9", linkedTags: 3 });

    await expect(
      approveCustomTagAction({ ...newTagInput, slug: "  iphone  ", labels: { ru: "  Айфон  " } }),
    ).resolves.toEqual({
      ok: true,
      data: { normalizedText: "айфон", tagId: "t9", linkedTags: 3 },
    });
    expect(approve).toHaveBeenCalledWith({
      mode: "new",
      normalizedText: "айфон",
      slug: "iphone",
      labels: { ru: "Айфон" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/tags");
  });

  it("refuses a slug that is not lower-case Latin with digits and hyphens", async () => {
    const result = await approveCustomTagAction({ ...newTagInput, slug: "Айфон" });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "slug" });
    expect(approve).not.toHaveBeenCalled();
  });

  it("names the language whose caption is empty", async () => {
    const result = await approveCustomTagAction({ ...newTagInput, labels: { ru: "   " } });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "labels.ru" });
    expect(approve).not.toHaveBeenCalled();
  });

  it("refuses a body that mixes both modes", async () => {
    const result = await approveCustomTagAction({ ...newTagInput, tagId: "t1" });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(approve).not.toHaveBeenCalled();
  });

  it("answers an already taken slug as a conflict on the slug field", async () => {
    approve.mockResolvedValue({ ok: false, reason: "SLUG_TAKEN" });

    await expect(approveCustomTagAction(newTagInput)).resolves.toEqual({
      ok: false,
      code: "CONFLICT",
      message: "Conflict",
      reason: "CUSTOM_TAG_SLUG_TAKEN",
      field: "slug",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("answers a repeated decision as a conflict", async () => {
    approve.mockResolvedValue({ ok: false, reason: "ALREADY_DECIDED" });

    await expect(approveCustomTagAction(newTagInput)).resolves.toMatchObject({
      ok: false,
      code: "CONFLICT",
      reason: "CUSTOM_TAG_DECIDED",
    });
  });

  it("answers an empty text as validation", async () => {
    approve.mockResolvedValue({ ok: false, reason: "EMPTY_TEXT" });

    await expect(approveCustomTagAction(newTagInput)).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "normalizedText",
    });
  });
});

describe("approval through an existing catalog tag (Story 10.2)", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });
  });

  it("passes the chosen tag to the store", async () => {
    approve.mockResolvedValue({ ok: true, tagId: "t1", linkedTags: 1 });

    await expect(approveCustomTagAction(existingTagInput)).resolves.toMatchObject({
      ok: true,
      data: { tagId: "t1", linkedTags: 1 },
    });
    expect(approve).toHaveBeenCalledWith(existingTagInput);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/tags");
  });

  it("refuses an existing-tag approval without a tag id", async () => {
    const result = await approveCustomTagAction({
      mode: "existing",
      normalizedText: "айфон",
      tagId: "",
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "tagId" });
    expect(approve).not.toHaveBeenCalled();
  });

  it("answers a vanished catalog tag with the dedicated reason", async () => {
    approve.mockResolvedValue({ ok: false, reason: "TAG_MISSING" });

    await expect(approveCustomTagAction(existingTagInput)).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "CATALOG_TAG_MISSING",
      field: "tagId",
    });
  });
});

describe("rejection (Story 10.2)", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin1" });
  });

  it("rejects one queue line and refreshes the queue", async () => {
    reject.mockResolvedValue({ ok: true });

    await expect(rejectCustomTagAction({ normalizedText: "айфон" })).resolves.toEqual({
      ok: true,
      data: { normalizedText: "айфон" },
    });
    expect(reject).toHaveBeenCalledWith("айфон");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/tags");
  });

  it("refuses an empty text before the store", async () => {
    const result = await rejectCustomTagAction({ normalizedText: "   " });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "normalizedText" });
    expect(reject).not.toHaveBeenCalled();
  });

  it("answers a repeated rejection as a conflict", async () => {
    reject.mockResolvedValue({ ok: false, reason: "ALREADY_DECIDED" });

    await expect(rejectCustomTagAction({ normalizedText: "айфон" })).resolves.toMatchObject({
      ok: false,
      code: "CONFLICT",
      reason: "CUSTOM_TAG_DECIDED",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
