// CLE-144 (Story 10.2, AD-22, AD-27): the custom tag moderation store — queue,
// approval into a new or existing catalog tag, rejection — on mocked Prisma.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  transaction,
  tagFindMany,
  giftTagFindMany,
  moderationFindMany,
  moderationFindUnique,
  txTagFindUnique,
  txTagCreate,
  txGiftTagFindMany,
  txGiftTagUpdateMany,
  txModerationFindUnique,
  txModerationCreate,
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
    transaction: vi.fn(),
    tagFindMany: vi.fn(),
    giftTagFindMany: vi.fn(),
    moderationFindMany: vi.fn(),
    moderationFindUnique: vi.fn(),
    txTagFindUnique: vi.fn(),
    txTagCreate: vi.fn(),
    txGiftTagFindMany: vi.fn(),
    txGiftTagUpdateMany: vi.fn(),
    txModerationFindUnique: vi.fn(),
    txModerationCreate: vi.fn(),
    PrismaClientKnownRequestError,
  };
});

const tx = {
  tag: { findUnique: txTagFindUnique, create: txTagCreate },
  giftTag: { findMany: txGiftTagFindMany, updateMany: txGiftTagUpdateMany },
  customTagModeration: {
    findUnique: txModerationFindUnique,
    create: txModerationCreate,
  },
};

vi.mock("@/db/client", () => ({
  prisma: {
    $transaction: transaction,
    tag: { findMany: tagFindMany },
    giftTag: { findMany: giftTagFindMany },
    customTagModeration: {
      findMany: moderationFindMany,
      findUnique: moderationFindUnique,
      create: txModerationCreate,
    },
  },
}));

vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError } }));

import { isGiftTagApprovedForAggregates } from "@/domain/tag";
import {
  approveCustomTag,
  listCustomTagQueue,
  listTagCatalogForAdmin,
  rejectCustomTag,
  type CustomTagDecisionRow,
} from "./custom-tag-store";

/** The rows of one wish pair: two spellings of one text and one other text. */
const customRows = [
  { id: "t1", giftId: "g1", customText: "Айфон" },
  { id: "t2", giftId: "g1", customText: "айфон" },
  { id: "t3", giftId: "g2", customText: "Айфон" },
  { id: "t4", giftId: "g3", customText: "Ноутбук" },
];

beforeEach(() => {
  vi.clearAllMocks();
  transaction.mockImplementation(
    async (callback: (client: unknown) => Promise<unknown>) => callback(tx),
  );
  tagFindMany.mockResolvedValue([]);
  giftTagFindMany.mockResolvedValue([]);
  moderationFindMany.mockResolvedValue([]);
  moderationFindUnique.mockResolvedValue(null);
  txTagFindUnique.mockResolvedValue(null);
  txTagCreate.mockResolvedValue({ id: "tag_phone" });
  txGiftTagFindMany.mockResolvedValue([]);
  txGiftTagUpdateMany.mockResolvedValue({ count: 0 });
  txModerationFindUnique.mockResolvedValue(null);
  txModerationCreate.mockResolvedValue({ id: "m1" });
});

describe("listCustomTagQueue", () => {
  it("reads custom rows of non-SECRET wishes and hides decided texts", async () => {
    giftTagFindMany.mockResolvedValue([
      { giftId: "g1", customText: "Айфон" },
      { giftId: "g1", customText: "айфон" },
      { giftId: "g2", customText: "Ноутбук" },
      { giftId: "g3", customText: "Кошка" },
    ]);
    moderationFindMany.mockResolvedValue([{ normalizedText: "кошка" }]);

    expect(await listCustomTagQueue()).toEqual([
      { normalizedText: "айфон", sampleText: "Айфон", usageCount: 1 },
      { normalizedText: "ноутбук", sampleText: "Ноутбук", usageCount: 1 },
    ]);

    // AD-22: secret wishes never reach the moderator.
    expect(giftTagFindMany).toHaveBeenCalledWith({
      where: {
        tagId: null,
        customText: { not: null },
        gift: { visibility: { not: "SECRET" } },
      },
      select: { giftId: true, customText: true },
    });
    // Nothing about an owner or a wish may leave the store.
    expect(JSON.stringify(await listCustomTagQueue())).not.toContain("g1");
  });

  it("orders by usage and then by text", async () => {
    giftTagFindMany.mockResolvedValue([
      { giftId: "g1", customText: "яблоко" },
      { giftId: "g2", customText: "банан" },
      { giftId: "g3", customText: "банан" },
      { giftId: "g4", customText: "арбуз" },
    ]);

    expect(
      (await listCustomTagQueue()).map(function text(line) {
        return line.normalizedText;
      }),
    ).toEqual(["банан", "арбуз", "яблоко"]);
  });
});

describe("listTagCatalogForAdmin", () => {
  it("maps the catalog in slug order with the default-language label", async () => {
    tagFindMany.mockResolvedValue([
      { id: "t2", slug: "someday", labels: { ru: "когда-нибудь" } },
      { id: "t1", slug: "dream", labels: { ru: "мечта" } },
      { id: "t3", slug: "blank", labels: {} },
    ]);

    expect(await listTagCatalogForAdmin()).toEqual([
      { id: "t1", slug: "dream", label: "мечта" },
      { id: "t2", slug: "someday", label: "когда-нибудь" },
    ]);
  });
});

describe("approveCustomTag", () => {
  const approval = {
    mode: "new" as const,
    normalizedText: "айфон",
    slug: "iphone",
    labels: { ru: "айфон" },
  };

  it("creates a catalog tag, links every row and records the decision", async () => {
    txGiftTagFindMany.mockResolvedValueOnce(customRows).mockResolvedValueOnce([]);

    const outcome = await approveCustomTag(approval);

    expect(outcome).toEqual({ ok: true, tagId: "tag_phone", linkedTags: 2 });
    expect(txTagCreate).toHaveBeenCalledWith({
      data: { slug: "iphone", labels: { ru: "айфон" } },
      select: { id: true },
    });
    // One row per wish: (giftId, tagId) is unique, so the second spelling of g1 stays as is.
    expect(txGiftTagUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["t1", "t3"] } },
      data: { tagId: "tag_phone", aggregateEligible: true },
    });
    expect(txModerationCreate).toHaveBeenCalledWith({
      data: { normalizedText: "айфон", decision: "APPROVED", tagId: "tag_phone" },
    });

    // The rows the transaction writes become aggregate-eligible (AD-22).
    const update = txGiftTagUpdateMany.mock.calls[0]![0] as {
      data: { tagId: string; aggregateEligible: boolean };
    };
    expect(isGiftTagApprovedForAggregates(update.data)).toBe(true);
  });

  it("approves into an existing catalog tag without creating a tag", async () => {
    txTagFindUnique.mockResolvedValue({ id: "tag_phone" });
    txGiftTagFindMany.mockResolvedValueOnce(customRows).mockResolvedValueOnce([]);

    expect(
      await approveCustomTag({ mode: "existing", normalizedText: "айфон", tagId: "tag_phone" }),
    ).toEqual({ ok: true, tagId: "tag_phone", linkedTags: 2 });
    expect(txTagFindUnique).toHaveBeenCalledWith({
      where: { id: "tag_phone" },
      select: { id: true },
    });
    expect(txTagCreate).not.toHaveBeenCalled();
  });

  it("skips a wish that already has the catalog tag and does not fail the transaction", async () => {
    txGiftTagFindMany
      .mockResolvedValueOnce(customRows)
      .mockResolvedValueOnce([{ giftId: "g1" }, { giftId: "g2" }]);

    expect(await approveCustomTag(approval)).toEqual({
      ok: true,
      tagId: "tag_phone",
      linkedTags: 0,
    });
    expect(txGiftTagUpdateMany).not.toHaveBeenCalled();
    // The decision still hides the text from the queue, even with nothing to link.
    expect(txModerationCreate).toHaveBeenCalled();
  });

  it("refuses a repeated decision", async () => {
    txModerationFindUnique.mockResolvedValue({ id: "m1" });

    expect(await approveCustomTag(approval)).toEqual({
      ok: false,
      reason: "ALREADY_DECIDED",
    });
    expect(txTagCreate).not.toHaveBeenCalled();
    expect(txModerationCreate).not.toHaveBeenCalled();
  });

  it("refuses a taken slug", async () => {
    txTagFindUnique.mockResolvedValue({ id: "tag_existing" });

    expect(await approveCustomTag(approval)).toEqual({ ok: false, reason: "SLUG_TAKEN" });
    expect(txTagCreate).not.toHaveBeenCalled();
  });

  it("refuses an existing id that is not in the catalog", async () => {
    txTagFindUnique.mockResolvedValue(null);

    expect(
      await approveCustomTag({ mode: "existing", normalizedText: "айфон", tagId: "tag_gone" }),
    ).toEqual({ ok: false, reason: "TAG_MISSING" });
  });

  it("maps a concurrent unique violation to a repeated decision, not a crash", async () => {
    transaction.mockRejectedValue(
      new PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002" }),
    );
    moderationFindUnique.mockResolvedValue({ id: "m1" });

    expect(await approveCustomTag(approval)).toEqual({
      ok: false,
      reason: "ALREADY_DECIDED",
    });
  });

  it("maps a concurrent slug race to SLUG_TAKEN", async () => {
    transaction.mockRejectedValue(
      new PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002" }),
    );
    moderationFindUnique.mockResolvedValue(null);

    expect(await approveCustomTag(approval)).toEqual({ ok: false, reason: "SLUG_TAKEN" });
  });

  it("normalizes the queue key before the decision", async () => {
    txGiftTagFindMany.mockResolvedValueOnce(customRows).mockResolvedValueOnce([]);

    await approveCustomTag({ ...approval, normalizedText: "  АЙФОН " });

    expect(txModerationCreate).toHaveBeenCalledWith({
      data: { normalizedText: "айфон", decision: "APPROVED", tagId: "tag_phone" },
    });
  });

  it("rejects an empty key without writing", async () => {
    expect(await approveCustomTag({ ...approval, normalizedText: "   " })).toEqual({
      ok: false,
      reason: "EMPTY_TEXT",
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("rejectCustomTag", () => {
  it("records the decision and leaves every tag row untouched", async () => {
    expect(await rejectCustomTag("  АЙФОН ")).toEqual({ ok: true });

    expect(txModerationCreate).toHaveBeenCalledWith({
      data: { normalizedText: "айфон", decision: "REJECTED" },
    });
    expect(txGiftTagUpdateMany).not.toHaveBeenCalled();
    expect(txTagCreate).not.toHaveBeenCalled();
  });

  it("refuses a repeated decision", async () => {
    txModerationCreate.mockRejectedValue(
      new PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002" }),
    );

    expect(await rejectCustomTag("айфон")).toEqual({ ok: false, reason: "ALREADY_DECIDED" });
  });

  it("rejects an empty key without writing", async () => {
    expect(await rejectCustomTag("  ")).toEqual({ ok: false, reason: "EMPTY_TEXT" });
    expect(txModerationCreate).not.toHaveBeenCalled();
  });
});

/** Compile-time guard: the store hands the write path only decision fields. */
const sampleDecision: CustomTagDecisionRow = { decision: "APPROVED", tagId: "tag_phone" };
void sampleDecision;
