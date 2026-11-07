import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { actionResultSchema, giftCardSchema, listDataSchema, meSchema, type ActionResult } from "./index";

const giftCard = {
  id: "g1",
  title: "Книга",
  description: null,
  priceAmount: null,
  priceCurrency: null,
  linkUrl: null,
  visibility: "FRIENDS",
  quantity: "SINGLE",
  expiresOn: null,
  archivedAt: null,
  tags: [{ catalogId: null, label: "чтение" }],
  status: "OPEN",
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
};

describe("actionResultSchema", () => {
  const schema = actionResultSchema(z.object({ id: z.string() }));

  it("accepts success with valid data", () => {
    expect(schema.safeParse({ ok: true, data: { id: "x" } }).success).toBe(true);
  });

  it("rejects success with invalid data", () => {
    expect(schema.safeParse({ ok: true, data: { id: 1 } }).success).toBe(false);
  });

  it("accepts RESET_LINK_STALE", () => {
    expect(
      schema.safeParse({
        ok: false,
        code: "VALIDATION",
        message: "Reset link is stale",
        reason: "RESET_LINK_STALE",
      }).success,
    ).toBe(true);
  });

  it("accepts INVITE_COOLDOWN with integer hours (Story 4.2.2)", () => {
    expect(
      schema.safeParse({
        ok: false,
        code: "RATE_LIMITED",
        message: "Invite cooldown is active",
        reason: "INVITE_COOLDOWN",
        params: { hours: 3 },
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        ok: false,
        code: "RATE_LIMITED",
        message: "?",
        reason: "INVITE_COOLDOWN",
        params: { hours: "3" },
      }).success,
    ).toBe(true);
  });

  it("accepts an error with reason and field", () => {
    const result = schema.safeParse({
      ok: false,
      code: "VALIDATION",
      message: "Проверьте поля",
      reason: "NICK_TAKEN",
      field: "nick",
    });
    expect(result.success).toBe(true);
  });

  it("accepts params of primitives and rejects nested values", () => {
    const base = { ok: false, code: "VALIDATION", message: "?" };
    expect(schema.safeParse({ ...base, params: { max: 3, until: "2026-11-01", f: false, n: null } }).success).toBe(true);
    expect(schema.safeParse({ ...base, params: { x: {} } }).success).toBe(false);
  });

  it("rejects an unknown reason and the removed fieldErrors", () => {
    const base = { ok: false, code: "VALIDATION", message: "?" };
    expect(schema.safeParse({ ...base, reason: "WHATEVER" }).success).toBe(false);
    expect(schema.safeParse({ ...base, fieldErrors: { a: "b" } }).success).toBe(false);
  });

  it("rejects an unknown error code", () => {
    expect(schema.safeParse({ ok: false, code: "TEAPOT", message: "?" }).success).toBe(false);
  });

  it("rejects keys outside the envelope", () => {
    expect(schema.safeParse({ ok: true, data: { id: "x" }, code: "CONFLICT" }).success).toBe(false);
    expect(schema.safeParse({ ok: false, code: "CONFLICT", message: "?", data: {} }).success).toBe(false);
  });

  it("matches the ActionResult type", () => {
    expectTypeOf<z.infer<typeof schema>>().toEqualTypeOf<ActionResult<{ id: string }>>();
  });
});

// Required keys of `giftCardSchema`; the test below keeps this list in sync with the schema shape.
const GIFT_CARD_FIELDS = [
  "id",
  "title",
  "description",
  "priceAmount",
  "priceCurrency",
  "linkUrl",
  "visibility",
  "quantity",
  "expiresOn",
  "archivedAt",
  "tags",
  "status",
  "reservedBy",
  "reservationLabel",
  "ownerAction",
] as const;

describe("giftCardSchema", () => {
  it("accepts an AD-12 gift card with nullable fields", () => {
    expect(giftCardSchema.safeParse(giftCard).success).toBe(true);
  });

  it("accepts a reserved card with holder and price", () => {
    const card = {
      ...giftCard,
      priceAmount: 12_50,
      priceCurrency: "BYN",
      status: "RESERVED",
      reservedBy: { id: "u1", nick: "anna", displayName: "Анна" },
      reservationLabel: "BOUGHT",
    };
    expect(giftCardSchema.safeParse(card).success).toBe(true);
  });

  it("rejects fields outside the closed set", () => {
    expect(giftCardSchema.safeParse({ ...giftCard, bought: true }).success).toBe(false);
  });

  it("rejects unknown keys in the holder and tags", () => {
    const holder = { id: "u1", nick: "anna", displayName: "Анна", email: "a@example.com" };
    expect(giftCardSchema.safeParse({ ...giftCard, status: "RESERVED", reservedBy: holder }).success).toBe(false);
    expect(giftCardSchema.safeParse({ ...giftCard, tags: [{ catalogId: null, label: "x", extra: 1 }] }).success).toBe(false);
  });

  it("rejects a currency outside the list", () => {
    expect(giftCardSchema.safeParse({ ...giftCard, priceAmount: 100, priceCurrency: "GBP" }).success).toBe(false);
  });

  it("lists exactly the keys of the schema", () => {
    expect([...GIFT_CARD_FIELDS].sort()).toEqual(Object.keys(giftCardSchema.shape).sort());
  });

  it.each(GIFT_CARD_FIELDS)("requires the %s field of the closed set", (field) => {
    const withoutField = Object.fromEntries(Object.entries(giftCard).filter(([key]) => key !== field));
    const result = giftCardSchema.safeParse(withoutField);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path[0])).toContain(field);
  });

  it("rejects statuses and labels outside the closed sets", () => {
    expect(giftCardSchema.safeParse({ ...giftCard, status: "COLLECTION" }).success).toBe(false);
    expect(giftCardSchema.safeParse({ ...giftCard, visibility: "FRIENDS_ONLY" }).success).toBe(false);
    expect(giftCardSchema.safeParse({ ...giftCard, quantity: "MANY" }).success).toBe(false);
    expect(giftCardSchema.safeParse({ ...giftCard, reservationLabel: "RETURNED" }).success).toBe(false);
    expect(giftCardSchema.safeParse({ ...giftCard, ownerAction: "RELEASE" }).success).toBe(false);
  });

  it("accepts an owner card with an owner action and a hidden holder", () => {
    const card = { ...giftCard, status: "RESERVED", reservedBy: null, ownerAction: "CONFIRM_GIVEN" };
    expect(giftCardSchema.safeParse(card).success).toBe(true);
    expect(giftCardSchema.safeParse({ ...card, status: "CLOSED", ownerAction: "EXPIRED_NO_REPLY" }).success).toBe(
      true,
    );
  });
});

describe("listDataSchema", () => {
  it("accepts a not_found gate with no gifts", () => {
    expect(listDataSchema.safeParse({ access: "not_found", gifts: [] }).success).toBe(true);
  });

  it("rejects a not_found gate that carries gifts", () => {
    expect(listDataSchema.safeParse({ access: "not_found", gifts: [giftCard] }).success).toBe(false);
  });

  it("accepts open access with gifts", () => {
    expect(listDataSchema.safeParse({ access: "gifts", gifts: [giftCard] }).success).toBe(true);
  });

  it("accepts open access with an empty wishlist", () => {
    expect(listDataSchema.safeParse({ access: "gifts", gifts: [] }).success).toBe(true);
  });

  /** Story 2.4 (AD-6): only the owner answer carries the share token. */
  it("accepts the owner's publicToken on open access", () => {
    expect(
      listDataSchema.safeParse({ access: "gifts", gifts: [], publicToken: "clx1example" }).success,
    ).toBe(true);
    expect(listDataSchema.safeParse({ access: "gifts", gifts: [], publicToken: 42 }).success).toBe(
      false,
    );
  });

  it("rejects a publicToken on a closed gate", () => {
    expect(
      listDataSchema.safeParse({ access: "not_found", gifts: [], publicToken: "clx1example" })
        .success,
    ).toBe(false);
  });

  /** Story 3.3: a link read names the owner; a closed gate never does. */
  it("accepts the owner block on open access and rejects it on a closed gate", () => {
    const owner = { displayName: "Анна", nick: "anna" };
    expect(listDataSchema.safeParse({ access: "gifts", gifts: [], owner }).success).toBe(true);
    expect(listDataSchema.safeParse({ access: "not_found", gifts: [], owner }).success).toBe(false);
  });

  it("rejects an owner block with extra fields or missing names", () => {
    expect(
      listDataSchema.safeParse({
        access: "gifts",
        gifts: [],
        owner: { displayName: "Анна", nick: "anna", email: "a@example.com" },
      }).success,
    ).toBe(false);
    expect(listDataSchema.safeParse({ access: "gifts", gifts: [], owner: { nick: "anna" } }).success).toBe(
      false,
    );
  });

  it("rejects keys outside the list data and unknown access values", () => {
    expect(listDataSchema.safeParse({ access: "gifts", gifts: [], total: 0 }).success).toBe(false);
    expect(listDataSchema.safeParse({ access: "hidden", gifts: [] }).success).toBe(false);
  });
});

describe("meSchema", () => {
  it("is strict", () => {
    const me = { id: "u1", email: "a@example.com", name: "Анна", nick: "anna", timeZone: null };
    expect(meSchema.safeParse(me).success).toBe(true);
    expect(meSchema.safeParse({ ...me, timeZone: "Europe/Minsk" }).success).toBe(true);
    expect(meSchema.safeParse({ ...me, hideFromSearch: true }).success).toBe(false);
  });
});
