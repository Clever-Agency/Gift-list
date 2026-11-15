import { describe, expect, it } from "vitest";

import { USER_SEARCH_QUERY_MAX } from "./search";
import {
  CIRCLE_PAGE_SIZE,
  circleCardSchema,
  circleInvitesDataSchema,
  circleInvitesQuerySchema,
  circleListQuerySchema,
  circlePageSchema,
} from "./circle";
import { FRIEND_CANCEL_OUTCOMES, friendCancelDataSchema } from "./friendship";

const card = {
  displayName: "Алёна",
  nick: "alena",
  relationship: "FRIENDS",
  subscribed: true,
  followsYou: false,
};

describe("CIRCLE_PAGE_SIZE", () => {
  it("is one size for both clients", () => {
    expect(CIRCLE_PAGE_SIZE).toBe(15);
  });
});

describe("circleCardSchema", () => {
  it("keeps only the row fields and the two subscription facts", () => {
    expect(circleCardSchema.parse(card)).toEqual(card);
    expect(Object.keys(circleCardSchema.shape).sort()).toEqual(
      ["displayName", "followsYou", "nick", "relationship", "subscribed"].sort(),
    );
  });

  it("rejects the internal id, the sort key and any private field (NFR-3)", () => {
    for (const extra of [
      { id: "u1" },
      { nameNormalized: "алена" },
      { email: "a@example.com" },
      { hideFromSearch: true },
      { gifts: [] },
      { inviteCooldown: { hours: 5, rejected: true } },
    ]) {
      expect(circleCardSchema.safeParse({ ...card, ...extra }).success, JSON.stringify(extra)).toBe(
        false,
      );
    }
  });

  it("requires both booleans and the closed relation", () => {
    const withoutSubscribed = Object.fromEntries(
      Object.entries(card).filter(([key]) => key !== "subscribed"),
    );
    const withoutFollowsYou = Object.fromEntries(
      Object.entries(card).filter(([key]) => key !== "followsYou"),
    );

    expect(circleCardSchema.safeParse(withoutSubscribed).success).toBe(false);
    expect(circleCardSchema.safeParse(withoutFollowsYou).success).toBe(false);
    expect(circleCardSchema.safeParse({ ...card, relationship: "BLOCKED" }).success).toBe(false);
    expect(circleCardSchema.safeParse({ ...card, subscribed: "yes" }).success).toBe(false);
    expect(circleCardSchema.safeParse({ ...card, followsYou: 1 }).success).toBe(false);
  });
});

describe("circlePageSchema", () => {
  it("accepts an empty first page", () => {
    expect(circlePageSchema.parse({ items: [], nextCursor: null, total: 0 })).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
    });
  });

  it("carries rows, an opaque cursor and the full total", () => {
    const page = { items: [card], nextCursor: "алена|cuid2", total: 17 };

    expect(circlePageSchema.parse(page)).toEqual(page);
    expect(circlePageSchema.safeParse({ ...page, total: -1 }).success).toBe(false);
    expect(circlePageSchema.safeParse({ ...page, total: 1.5 }).success).toBe(false);
    expect(circlePageSchema.safeParse({ ...page, nextCursor: undefined }).success).toBe(false);
    expect(circlePageSchema.safeParse({ ...page, pageSize: CIRCLE_PAGE_SIZE }).success).toBe(false);
  });
});

describe("circleListQuerySchema", () => {
  it("treats an absent or blank query as the whole list", () => {
    expect(circleListQuerySchema.parse({})).toEqual({});
    expect(circleListQuerySchema.parse({ q: "   " })).toEqual({ q: "" });
    expect(circleListQuerySchema.parse({ q: "" })).toEqual({ q: "" });
  });

  it("keeps a real query and the opaque cursor", () => {
    expect(circleListQuerySchema.parse({ q: "  @Алена ", cursor: "алена|cuid2" })).toEqual({
      q: "@Алена",
      cursor: "алена|cuid2",
    });
  });

  it("rejects a query over the search cap or with control characters", () => {
    expect(circleListQuerySchema.safeParse({ q: "а".repeat(USER_SEARCH_QUERY_MAX) }).success).toBe(
      true,
    );
    expect(
      circleListQuerySchema.safeParse({ q: "а".repeat(USER_SEARCH_QUERY_MAX + 1) }).success,
    ).toBe(false);
    expect(circleListQuerySchema.safeParse({ q: "Ан\u0000на" }).success).toBe(false);
  });

  it("rejects keys outside the query", () => {
    expect(circleListQuerySchema.safeParse({ limit: 100 }).success).toBe(false);
  });
});

describe("circleInvitesQuerySchema", () => {
  it("accepts no cursors and one cursor per half", () => {
    expect(circleInvitesQuerySchema.parse({})).toEqual({});
    expect(
      circleInvitesQuerySchema.parse({
        incomingCursor: "алена|cuid2",
        outgoingCursor: "борис|cuid3",
      }),
    ).toEqual({ incomingCursor: "алена|cuid2", outgoingCursor: "борис|cuid3" });
    expect(circleInvitesQuerySchema.safeParse({ cursor: "x" }).success).toBe(false);
  });
});

describe("circleInvitesDataSchema", () => {
  const page = { items: [card], nextCursor: null, total: 1 };

  it("keeps the incoming and outgoing lists apart and the full badge count", () => {
    const data = { incoming: page, outgoing: { items: [], nextCursor: null, total: 0 }, incomingCount: 17 };

    expect(circleInvitesDataSchema.parse(data)).toEqual(data);
    expect(circleInvitesDataSchema.safeParse({ ...data, incomingCount: "17" }).success).toBe(false);
    expect(circleInvitesDataSchema.safeParse({ ...data, incomingCount: -1 }).success).toBe(false);
  });

  it("requires both halves and the count", () => {
    const data = { incoming: page, outgoing: page, incomingCount: 1 };
    const withoutIncoming = Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== "incoming"),
    );
    const withoutCount = Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== "incomingCount"),
    );

    expect(circleInvitesDataSchema.safeParse(withoutIncoming).success).toBe(false);
    expect(circleInvitesDataSchema.safeParse(withoutCount).success).toBe(false);
  });

  it("rejects one merged list or extra keys", () => {
    expect(
      circleInvitesDataSchema.safeParse({
        incoming: page,
        outgoing: page,
        incomingCount: 1,
        items: [card],
      }).success,
    ).toBe(false);
  });
});

describe("friendCancelDataSchema", () => {
  it("carries the closed cancel outcomes", () => {
    expect(FRIEND_CANCEL_OUTCOMES).toEqual(["CANCELLED", "ALREADY_FRIENDS"]);
    for (const outcome of FRIEND_CANCEL_OUTCOMES) {
      expect(friendCancelDataSchema.parse({ outcome })).toEqual({ outcome });
    }
    expect(friendCancelDataSchema.safeParse({ outcome: "REJECTED" }).success).toBe(false);
    expect(friendCancelDataSchema.safeParse({ outcome: "CANCELLED", hours: 24 }).success).toBe(
      false,
    );
  });
});
