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
});

describe("meSchema", () => {
  it("is strict", () => {
    const me = { id: "u1", email: "a@example.com", name: "Анна", nick: "anna", timeZone: null };
    expect(meSchema.safeParse(me).success).toBe(true);
    expect(meSchema.safeParse({ ...me, timeZone: "Europe/Minsk" }).success).toBe(true);
    expect(meSchema.safeParse({ ...me, hideFromSearch: true }).success).toBe(false);
  });
});
