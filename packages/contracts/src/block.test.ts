import { describe, expect, it } from "vitest";
import {
  BLOCK_OUTCOMES,
  UNBLOCK_OUTCOMES,
  actionResultSchema,
  blockDataSchema,
  blockedListQuerySchema,
  blockedPageSchema,
  blockedCardSchema,
  unblockDataSchema,
} from "./index";

const row = { displayName: "Алёна", nick: "alena" };

describe("blockDataSchema (Story 4.5)", () => {
  it.each(BLOCK_OUTCOMES)("accepts the closed outcome %s", (outcome) => {
    expect(blockDataSchema.safeParse({ outcome }).success).toBe(true);
  });

  it("keeps exactly the two closed outcomes", () => {
    expect(BLOCK_OUTCOMES).toEqual(["BLOCKED", "ALREADY_BLOCKED"]);
    expect(blockDataSchema.safeParse({ outcome: "UNBLOCKED" }).success).toBe(false);
    expect(blockDataSchema.safeParse({ outcome: "blocked" }).success).toBe(false);
  });

  it("rejects extra fields, so no id, target or reverse-block fact can ride along", () => {
    expect(
      blockDataSchema.safeParse({ outcome: "BLOCKED", blockedId: "u1", blockedAt: 1 }).success,
    ).toBe(false);
    expect(blockDataSchema.safeParse({ outcome: "BLOCKED", reverse: true }).success).toBe(false);
  });

  it("fits the AD-12 success envelope", () => {
    const envelope = actionResultSchema(blockDataSchema);
    expect(envelope.safeParse({ ok: true, data: { outcome: "ALREADY_BLOCKED" } }).success).toBe(
      true,
    );
    expect(envelope.safeParse({ ok: true, data: { outcome: "BLOCKED", extra: 1 } }).success).toBe(
      false,
    );
  });
});

describe("unblockDataSchema (Story 4.5)", () => {
  it.each(UNBLOCK_OUTCOMES)("accepts the closed outcome %s", (outcome) => {
    expect(unblockDataSchema.safeParse({ outcome }).success).toBe(true);
  });

  it("keeps exactly the two closed outcomes", () => {
    expect(UNBLOCK_OUTCOMES).toEqual(["UNBLOCKED", "NOT_BLOCKED"]);
    expect(unblockDataSchema.safeParse({ outcome: "BLOCKED" }).success).toBe(false);
    expect(unblockDataSchema.safeParse({}).success).toBe(false);
  });

  it("rejects extra fields and never carries the reverse block", () => {
    expect(
      unblockDataSchema.safeParse({ outcome: "NOT_BLOCKED", stillBlocked: true }).success,
    ).toBe(false);
    expect(
      actionResultSchema(unblockDataSchema).safeParse({ ok: true, data: { outcome: "UNBLOCKED" } })
        .success,
    ).toBe(true);
  });
});

describe("blockedCardSchema", () => {
  it("shows only the name and the nick of the blocked person", () => {
    expect(blockedCardSchema.parse(row)).toEqual(row);
    expect(Object.keys(blockedCardSchema.shape).sort()).toEqual(["displayName", "nick"]);
  });

  it("rejects the internal id, the block time and any relation field", () => {
    for (const extra of [
      { id: "u1" },
      { blockedAt: "2026-11-16T00:00:00.000Z" },
      { email: "a@example.com" },
      { relationship: "NONE" },
      { subscribed: false },
      { followsYou: false },
      { avatar: "x" },
    ]) {
      expect(blockedCardSchema.safeParse({ ...row, ...extra }).success, JSON.stringify(extra)).toBe(
        false,
      );
    }
  });

  it("requires both strings", () => {
    expect(blockedCardSchema.safeParse({ nick: "alena" }).success).toBe(false);
    expect(blockedCardSchema.safeParse({ displayName: "Алёна" }).success).toBe(false);
    expect(blockedCardSchema.safeParse({ ...row, nick: 1 }).success).toBe(false);
  });
});

describe("blockedPageSchema", () => {
  it("accepts an empty first page", () => {
    expect(blockedPageSchema.parse({ items: [], nextCursor: null, total: 0 })).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
    });
  });

  it("carries an opaque cursor and the full total, never the page size", () => {
    const page = { items: [row], nextCursor: "1763251200000|cu2", total: 17 };

    expect(blockedPageSchema.parse(page)).toEqual(page);
    expect(blockedPageSchema.safeParse({ ...page, total: -1 }).success).toBe(false);
    expect(blockedPageSchema.safeParse({ ...page, total: 1.5 }).success).toBe(false);
    expect(blockedPageSchema.safeParse({ ...page, nextCursor: undefined }).success).toBe(false);
    expect(blockedPageSchema.safeParse({ ...page, pageSize: 15 }).success).toBe(false);
  });

  it("rejects rows outside the blocked-person contract", () => {
    expect(
      blockedPageSchema.safeParse({ items: [{ ...row, id: "u1" }], nextCursor: null, total: 1 })
        .success,
    ).toBe(false);
  });
});

describe("blockedListQuerySchema", () => {
  it("accepts no cursor and the opaque cursor of the previous page", () => {
    expect(blockedListQuerySchema.parse({})).toEqual({});
    expect(blockedListQuerySchema.parse({ cursor: "1763251200000|cu2" })).toEqual({
      cursor: "1763251200000|cu2",
    });
  });

  it("rejects keys outside the query: the block list is not searchable", () => {
    expect(blockedListQuerySchema.safeParse({ q: "алена" }).success).toBe(false);
    expect(blockedListQuerySchema.safeParse({ limit: 100 }).success).toBe(false);
    expect(blockedListQuerySchema.safeParse({ cursor: 1 }).success).toBe(false);
  });
});
