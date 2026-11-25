import { describe, expect, it } from "vitest";
import { CURRENCIES, QUANTITIES, RESERVATION_PHASES, VISIBILITIES } from "./enums";
import {
  GIFT_DESCRIPTION_MAX,
  GIFT_LINK_URL_MAX,
  GIFT_TAG_TEXT_MAX,
  GIFT_TITLE_MAX,
  giftInputSchema,
  giftRestoreSchema,
  giftUpdateSchema,
  giftVisibilityPreviewQuerySchema,
  giftVisibilityPreviewSchema,
  reservationActionBodySchema,
  reservationCardSchema,
  reservationListSchema,
} from "./gift";

describe("giftInputSchema", () => {
  it("fills an empty body with nulls and PUBLIC visibility", () => {
    expect(giftInputSchema.parse({ title: "Книга" })).toEqual({
      title: "Книга",
      description: null,
      priceAmount: null,
      priceCurrency: null,
      linkUrl: null,
      visibility: "PUBLIC",
      quantity: "SINGLE",
      expiresOn: null,
      tags: [],
    });
  });

  it("trims the title", () => {
    expect(giftInputSchema.parse({ title: "  Книга  " }).title).toBe("Книга");
  });

  it("rejects a missing, empty or blank title", () => {
    for (const body of [{ title: "" }, { title: "   " }, {}]) {
      const parsed = giftInputSchema.safeParse(body);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["title"]);
    }
  });

  it("rejects a title over the cap", () => {
    expect(giftInputSchema.safeParse({ title: "x".repeat(GIFT_TITLE_MAX) }).success).toBe(true);
    expect(giftInputSchema.safeParse({ title: "x".repeat(GIFT_TITLE_MAX + 1) }).success).toBe(false);
  });

  it("defaults the currency to USD when only the amount is set", () => {
    const parsed = giftInputSchema.parse({ title: "Книга", priceAmount: 12_50 });
    expect(parsed.priceAmount).toBe(12_50);
    expect(parsed.priceCurrency).toBe("USD");
  });

  it.each(CURRENCIES)("keeps the %s currency with an amount", (currency) => {
    const parsed = giftInputSchema.parse({ title: "Книга", priceAmount: 100, priceCurrency: currency });
    expect(parsed.priceCurrency).toBe(currency);
  });

  it("drops the currency when no amount is set", () => {
    const parsed = giftInputSchema.parse({ title: "Книга", priceCurrency: "EUR" });
    expect(parsed.priceAmount).toBeNull();
    expect(parsed.priceCurrency).toBeNull();
  });

  it("rejects a currency outside the list", () => {
    expect(giftInputSchema.safeParse({ title: "Книга", priceAmount: 100, priceCurrency: "GBP" }).success).toBe(
      false,
    );
  });

  it.each([-1, 12.5, "100"])("rejects a negative, fractional or non-number amount: %j", (priceAmount) => {
    const parsed = giftInputSchema.safeParse({ title: "Книга", priceAmount });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["priceAmount"]);
  });

  it("turns blank description and link into null", () => {
    for (const blank of ["", "   "]) {
      const parsed = giftInputSchema.parse({ title: "Книга", description: blank, linkUrl: blank });
      expect(parsed.description).toBeNull();
      expect(parsed.linkUrl).toBeNull();
    }
  });

  it.each(["javascript:alert(1)", "ftp://example.com/item", "example.com/item"])(
    "rejects a link that is not http(s): %j",
    (linkUrl) => {
      const parsed = giftInputSchema.safeParse({ title: "Книга", linkUrl });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["linkUrl"]);
    },
  );

  it("keeps a valid https link", () => {
    expect(giftInputSchema.parse({ title: "Книга", linkUrl: "https://example.com/item?x=1" }).linkUrl).toBe(
      "https://example.com/item?x=1",
    );
  });

  it.each(VISIBILITIES)("accepts the %s visibility", (visibility) => {
    expect(giftInputSchema.parse({ title: "Книга", visibility }).visibility).toBe(visibility);
  });

  it("defaults the quantity to SINGLE", () => {
    expect(giftInputSchema.parse({ title: "Книга" }).quantity).toBe("SINGLE");
  });

  it.each(QUANTITIES)("accepts the %s quantity", (quantity) => {
    expect(giftInputSchema.parse({ title: "Книга", quantity }).quantity).toBe(quantity);
  });

  it("rejects a quantity outside the list", () => {
    const parsed = giftInputSchema.safeParse({ title: "Книга", quantity: "MANY" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["quantity"]);
  });

  it("rejects keys outside the body", () => {
    expect(giftInputSchema.safeParse({ title: "Книга", bought: true }).success).toBe(false);
  });

  it("keeps an optional calendar day and treats a blank as no date", () => {
    expect(giftInputSchema.parse({ title: "Книга", expiresOn: "2026-12-31" }).expiresOn).toBe(
      "2026-12-31",
    );
    expect(giftInputSchema.parse({ title: "Книга", expiresOn: "" }).expiresOn).toBe(null);
    expect(giftInputSchema.parse({ title: "Книга", expiresOn: null }).expiresOn).toBe(null);
  });

  it("rejects a day that is not on the calendar", () => {
    expect(giftInputSchema.safeParse({ title: "Книга", expiresOn: "2026-02-31" }).success).toBe(
      false,
    );
    expect(giftInputSchema.safeParse({ title: "Книга", expiresOn: "31.12.2026" }).success).toBe(
      false,
    );
  });
});

describe("gift tags", () => {
  it("defaults a create body to no tags", () => {
    expect(giftInputSchema.parse({ title: "Книга" }).tags).toEqual([]);
  });

  it("accepts a catalog tag by id and a custom tag by text", () => {
    expect(
      giftInputSchema.parse({
        title: "Книга",
        tags: [{ catalogId: "tag_1" }, { text: "  для дома  " }],
      }).tags,
    ).toEqual([{ catalogId: "tag_1" }, { text: "для дома" }]);
  });

  it("trims a custom tag and rejects an empty or blank one", () => {
    expect(giftInputSchema.parse({ title: "Книга", tags: [{ text: "  мечта  " }] }).tags).toEqual([
      { text: "мечта" },
    ]);

    for (const text of ["", "   "]) {
      expect(giftInputSchema.safeParse({ title: "Книга", tags: [{ text }] }).success).toBe(false);
    }
  });

  it("counts custom tag length in Unicode code points", () => {
    const atLimit = "😀".repeat(GIFT_TAG_TEXT_MAX);
    const overLimit = "😀".repeat(GIFT_TAG_TEXT_MAX + 1);

    // A surrogate pair is two JS units but one code point, like PostgreSQL's VARCHAR.
    expect(atLimit.length).toBeGreaterThan(GIFT_TAG_TEXT_MAX);
    expect(giftInputSchema.safeParse({ title: "Книга", tags: [{ text: atLimit }] }).success).toBe(
      true,
    );
    expect(
      giftInputSchema.safeParse({ title: "Книга", tags: [{ text: overLimit }] }).success,
    ).toBe(false);
  });

  it("rejects a tag with both sources or with neither", () => {
    for (const tag of [{ catalogId: "tag_1", text: "свой" }, {}]) {
      expect(giftInputSchema.safeParse({ title: "Книга", tags: [tag] }).success).toBe(false);
    }
  });

  it("rejects an empty catalog id", () => {
    expect(
      giftInputSchema.safeParse({ title: "Книга", tags: [{ catalogId: "   " }] }).success,
    ).toBe(false);
  });

  it("rejects NUL, which PostgreSQL cannot store in a VARCHAR", () => {
    expect(
      giftInputSchema.safeParse({ title: "Книга", tags: [{ text: "свой\u0000тег" }] }).success,
    ).toBe(false);
  });

  it("rejects duplicate catalog ids and duplicate custom texts", () => {
    const duplicates = [
      [{ catalogId: "tag_1" }, { catalogId: "tag_1" }],
      [{ text: "мечта" }, { text: "мечта" }],
      [{ text: " мечта " }, { text: "мечта" }],
    ];

    for (const tags of duplicates) {
      const parsed = giftInputSchema.safeParse({ title: "Книга", tags });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["tags"]);
    }
  });

  it("keeps a catalog id and an equal custom text apart", () => {
    expect(
      giftInputSchema.safeParse({
        title: "Книга",
        tags: [{ catalogId: "dream" }, { text: "dream" }],
      }).success,
    ).toBe(true);
  });

  it("never lets a client set aggregate eligibility or moderation fields", () => {
    for (const tag of [
      { catalogId: "tag_1", aggregateEligible: true },
      { text: "свой", aggregateEligible: true },
      { text: "свой", tagId: "tag_1" },
    ]) {
      expect(giftInputSchema.safeParse({ title: "Книга", tags: [tag] }).success).toBe(false);
    }
  });

  it("accepts an explicit empty list in a create body", () => {
    expect(giftInputSchema.parse({ title: "Книга", tags: [] }).tags).toEqual([]);
  });

  it("keeps tags out of an edit body that omits them", () => {
    expect(giftUpdateSchema.parse({ description: "Заметка" })).not.toHaveProperty("tags");
  });

  it("carries omitted, cleared and replaced tags into an edit body", () => {
    expect(giftUpdateSchema.parse({ tags: [] })).toEqual({ tags: [] });
    expect(giftUpdateSchema.parse({ tags: [{ catalogId: "tag_1" }] })).toEqual({
      tags: [{ catalogId: "tag_1" }],
    });
    expect(giftUpdateSchema.parse({ tags: [{ text: " свой " }] })).toEqual({
      tags: [{ text: "свой" }],
    });
  });

  it("applies the same tag rules to an edit body", () => {
    for (const tags of [[{ text: "   " }], [{ text: "😀".repeat(GIFT_TAG_TEXT_MAX + 1) }], [{ catalogId: "tag_1", aggregateEligible: true }]]) {
      expect(giftUpdateSchema.safeParse({ tags }).success).toBe(false);
    }
  });
});

describe("giftUpdateSchema", () => {
  it("keeps only the keys that came in", () => {
    expect(giftUpdateSchema.parse({ title: "Книга" })).toEqual({ title: "Книга" });
    expect(giftUpdateSchema.parse({ visibility: "SECRET" })).toEqual({ visibility: "SECRET" });
    expect(giftUpdateSchema.parse({ description: "  Заметка  " })).toEqual({ description: "Заметка" });
  });

  it("rejects an empty body", () => {
    const parsed = giftUpdateSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("trims the title and rejects a blank or empty one", () => {
    expect(giftUpdateSchema.parse({ title: "  Книга  " })).toEqual({ title: "Книга" });

    for (const title of ["", "   "]) {
      const parsed = giftUpdateSchema.safeParse({ title });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["title"]);
    }
  });

  it("rejects a null or over-long title", () => {
    for (const title of [null, "x".repeat(GIFT_TITLE_MAX + 1)]) {
      const parsed = giftUpdateSchema.safeParse({ title });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["title"]);
    }
    expect(giftUpdateSchema.safeParse({ title: "x".repeat(GIFT_TITLE_MAX) }).success).toBe(true);
  });

  it.each([
    ["description", ""],
    ["description", "   "],
    ["linkUrl", ""],
  ] as const)("turns a blank %s into null", (field, blank) => {
    expect(giftUpdateSchema.parse({ [field]: blank })).toEqual({ [field]: null });
  });

  it("clears description and link with an explicit null", () => {
    expect(giftUpdateSchema.parse({ description: null, linkUrl: null })).toEqual({
      description: null,
      linkUrl: null,
    });
  });

  it.each(["javascript:alert(1)", "ftp://example.com/item", "example.com/item"])(
    "rejects a link that is not http(s): %j",
    (linkUrl) => {
      const parsed = giftUpdateSchema.safeParse({ linkUrl });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["linkUrl"]);
    },
  );

  it("leaves the currency to the use-case when the amount comes without one", () => {
    // AD-25/Н1: a PATCH of the amount alone keeps the stored currency; only the
    // use-case knows whether there is one. The schema must not invent `USD`.
    expect(giftUpdateSchema.parse({ priceAmount: 12_50 })).toEqual({ priceAmount: 12_50 });
  });

  it("rejects a set amount with an explicit null currency", () => {
    // AD-25/D2: the amount and the currency are one price; `null` would store an
    // amount that no card can show. The field is named for the client.
    for (const body of [
      { priceAmount: 1000, priceCurrency: null },
      { priceAmount: 0, priceCurrency: null },
    ]) {
      const parsed = giftUpdateSchema.safeParse(body);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["priceCurrency"]);
    }
  });

  it.each(CURRENCIES)("keeps the %s currency with an amount", (currency) => {
    expect(giftUpdateSchema.parse({ priceAmount: 100, priceCurrency: currency })).toEqual({
      priceAmount: 100,
      priceCurrency: currency,
    });
  });

  it("clears both price fields when the amount is set to null", () => {
    expect(giftUpdateSchema.parse({ priceAmount: null })).toEqual({
      priceAmount: null,
      priceCurrency: null,
    });
    expect(giftUpdateSchema.parse({ priceAmount: null, priceCurrency: "EUR" })).toEqual({
      priceAmount: null,
      priceCurrency: null,
    });
  });

  it("keeps a lone currency for the use-case to combine with the stored amount", () => {
    expect(giftUpdateSchema.parse({ priceCurrency: "EUR" })).toEqual({ priceCurrency: "EUR" });
    expect(giftUpdateSchema.parse({ priceCurrency: null })).toEqual({ priceCurrency: null });
  });

  it.each([-1, 12.5, "100"])("rejects a negative, fractional or non-number amount: %j", (priceAmount) => {
    const parsed = giftUpdateSchema.safeParse({ priceAmount });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["priceAmount"]);
  });

  it("rejects a currency outside the list", () => {
    expect(giftUpdateSchema.safeParse({ priceCurrency: "GBP" }).success).toBe(false);
  });

  it.each(VISIBILITIES)("accepts the %s visibility without defaulting it", (visibility) => {
    expect(giftUpdateSchema.parse({ visibility })).toEqual({ visibility });
  });

  it.each(QUANTITIES)("accepts the %s quantity without defaulting it", (quantity) => {
    expect(giftUpdateSchema.parse({ quantity })).toEqual({ quantity });
  });

  it("does not add a default quantity to a body without it", () => {
    expect(giftUpdateSchema.parse({ description: "Заметка" })).not.toHaveProperty("quantity");
  });

  it("rejects a quantity outside the list", () => {
    const parsed = giftUpdateSchema.safeParse({ quantity: "MANY" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["quantity"]);
  });

  it("does not add a default visibility to a body without it", () => {
    expect(giftUpdateSchema.parse({ description: "Заметка" })).not.toHaveProperty("visibility");
  });

  it("rejects keys outside the body", () => {
    expect(giftUpdateSchema.safeParse({ description: "Заметка", bought: true }).success).toBe(false);
    expect(giftUpdateSchema.safeParse({ bought: true }).success).toBe(false);
  });

  it("sets or clears expiresOn without touching the other fields", () => {
    expect(giftUpdateSchema.parse({ expiresOn: "2026-12-31" })).toEqual({ expiresOn: "2026-12-31" });
    expect(giftUpdateSchema.parse({ expiresOn: null })).toEqual({ expiresOn: null });
    expect(giftUpdateSchema.parse({ title: "Книга" })).not.toHaveProperty("expiresOn");
  });
});

describe("giftRestoreSchema", () => {
  it("clears the date when the body omits it or sends a blank", () => {
    expect(giftRestoreSchema.parse({})).toEqual({ expiresOn: null });
    expect(giftRestoreSchema.parse({ expiresOn: "" })).toEqual({ expiresOn: null });
    expect(giftRestoreSchema.parse({ expiresOn: "2026-12-31" })).toEqual({
      expiresOn: "2026-12-31",
    });
  });

  it("rejects a non-day and any extra key", () => {
    expect(giftRestoreSchema.safeParse({ expiresOn: "2026-02-31" }).success).toBe(false);
    expect(giftRestoreSchema.safeParse({ expiresOn: null, title: "Книга" }).success).toBe(false);
  });
});

/**
 * PostgreSQL cannot store `U+0000` in `text`/`varchar`, so a body carrying it
 * must fail validation with the field named — not as a database error and a 500
 * (epic-2 QA report, D1). The custom tag text keeps its own rule above.
 */
describe("NUL in the gift text fields", () => {
  type Path = (string | number)[];

  const createBodies: [string, Record<string, unknown>, Path][] = [
    ["title", { title: "a\u0000b" }, ["title"]],
    ["description", { title: "Книга", description: "a\u0000b" }, ["description"]],
    ["linkUrl", { title: "Книга", linkUrl: "https://example.com/a\u0000b" }, ["linkUrl"]],
    [
      "tags[].catalogId",
      { title: "Книга", tags: [{ catalogId: "tag\u00001" }] },
      ["tags", 0, "catalogId"],
    ],
  ];

  const updateBodies: [string, Record<string, unknown>, Path][] = [
    ["title", { title: "a\u0000b" }, ["title"]],
    ["description", { description: "a\u0000b" }, ["description"]],
    ["linkUrl", { linkUrl: "https://example.com/a\u0000b" }, ["linkUrl"]],
    ["tags[].catalogId", { tags: [{ catalogId: "tag\u00001" }] }, ["tags", 0, "catalogId"]],
  ];

  it.each(createBodies)("rejects NUL in %s of a create body", (_label, body, path) => {
    const parsed = giftInputSchema.safeParse(body);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(path);
  });

  it.each(updateBodies)("rejects NUL in %s of an edit body", (_label, body, path) => {
    const parsed = giftUpdateSchema.safeParse(body);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(path);
  });

  it("keeps the same bodies without NUL valid", () => {
    expect(
      giftInputSchema.parse({
        title: "Книга",
        description: "Заметка",
        linkUrl: "https://example.com/item",
        tags: [{ catalogId: "tag_1" }],
      }),
    ).toMatchObject({ title: "Книга", description: "Заметка" });
    expect(
      giftUpdateSchema.parse({
        title: "Книга",
        description: "Заметка",
        linkUrl: "https://example.com/item",
        tags: [{ catalogId: "tag_1" }],
      }),
    ).toMatchObject({ title: "Книга" });
  });
});

/**
 * The caps are the contract's single source. Zod 4 counts them in Unicode code
 * points (the unit of `textLength`, which both clients use), while a `maxLength`
 * attribute would count UTF-16 units; these tests pin both measures down so the
 * form, the schema and Better Auth cannot drift silently.
 */
describe("gift text caps", () => {
  function linkOfLength(length: number): string {
    const prefix = "https://example.com/";
    return `${prefix}${"a".repeat(length - prefix.length)}`;
  }

  it("accepts exactly the title, description and link caps and rejects one more", () => {
    expect(giftInputSchema.safeParse({ title: "x".repeat(GIFT_TITLE_MAX) }).success).toBe(true);
    expect(giftInputSchema.safeParse({ title: "x".repeat(GIFT_TITLE_MAX + 1) }).success).toBe(false);

    expect(
      giftInputSchema.safeParse({ title: "Книга", description: "x".repeat(GIFT_DESCRIPTION_MAX) })
        .success,
    ).toBe(true);
    const longDescription = giftInputSchema.safeParse({
      title: "Книга",
      description: "x".repeat(GIFT_DESCRIPTION_MAX + 1),
    });
    expect(longDescription.success).toBe(false);
    if (!longDescription.success) {
      expect(longDescription.error.issues[0]?.path).toEqual(["description"]);
    }

    const atCap = linkOfLength(GIFT_LINK_URL_MAX);
    expect(atCap).toHaveLength(GIFT_LINK_URL_MAX);
    expect(giftInputSchema.safeParse({ title: "Книга", linkUrl: atCap }).success).toBe(true);
    const longLink = giftInputSchema.safeParse({ title: "Книга", linkUrl: linkOfLength(GIFT_LINK_URL_MAX + 1) });
    expect(longLink.success).toBe(false);
    if (!longLink.success) expect(longLink.error.issues[0]?.path).toEqual(["linkUrl"]);
  });

  it("counts an emoji as one code point, as the clients' textLength does", () => {
    const emoji = "😀";
    expect(emoji).toHaveLength(2);
    expect([...emoji]).toHaveLength(1);
    // The schema cap is in code points: 120 emoji fit, 121 do not. The same text
    // is 240 UTF-16 units, so a `maxLength` of 120 would have cut it at 60 — the
    // form sets none and checks the schema unit instead.
    expect(giftInputSchema.safeParse({ title: emoji.repeat(GIFT_TITLE_MAX) }).success).toBe(true);
    expect(giftInputSchema.safeParse({ title: emoji.repeat(GIFT_TITLE_MAX + 1) }).success).toBe(false);
    expect(emoji.repeat(GIFT_TITLE_MAX).length).toBe(GIFT_TITLE_MAX * 2);

    expect(
      giftInputSchema.safeParse({
        title: "Книга",
        description: emoji.repeat(GIFT_DESCRIPTION_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("counts Cyrillic and combining marks one per code point", () => {
    expect(giftInputSchema.safeParse({ title: "я".repeat(GIFT_TITLE_MAX) }).success).toBe(true);
    expect(giftInputSchema.safeParse({ title: "я".repeat(GIFT_TITLE_MAX + 1) }).success).toBe(false);

    // "е" followed by U+0301 is two code points (and two units), so half as many signed fit.
    const combining = "е\u0301";
    expect([...combining]).toHaveLength(2);
    expect(giftInputSchema.safeParse({ title: combining.repeat(GIFT_TITLE_MAX / 2) }).success).toBe(true);
    expect(giftInputSchema.safeParse({ title: combining.repeat(GIFT_TITLE_MAX / 2 + 1) }).success).toBe(false);
  });

  it("trims before applying the cap", () => {
    const padded = `  ${"x".repeat(GIFT_TITLE_MAX)}  `;
    expect(padded.length).toBeGreaterThan(GIFT_TITLE_MAX);
    expect(giftInputSchema.parse({ title: padded }).title).toHaveLength(GIFT_TITLE_MAX);
  });

  it("checks only the fields an edit carries, so a stored over-long value cannot block another edit", () => {
    // A row written before the cap (or outside the API) may hold a longer title;
    // an edit body that does not send that field never puts it through the cap.
    expect(giftUpdateSchema.parse({ visibility: "SECRET" })).toEqual({ visibility: "SECRET" });
    expect(giftUpdateSchema.parse({ description: "Заметка", tags: [] })).toEqual({
      description: "Заметка",
      tags: [],
    });
  });
});

/** CLE-82/S23.2 (FR-10): the confirm of a narrowing visibility change is a server preflight. */
describe("giftVisibilityPreview", () => {
  it.each(VISIBILITIES)("accepts the %s value in the preflight query", (visibility) => {
    expect(giftVisibilityPreviewQuerySchema.parse({ visibility })).toEqual({ visibility });
  });

  it("rejects a missing, unknown or foreign query value", () => {
    for (const query of [{}, { visibility: null }, { visibility: "EVERYONE" }, { visibility: [] }]) {
      const parsed = giftVisibilityPreviewQuerySchema.safeParse(query);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["visibility"]);
    }
  });

  it("rejects keys the preflight does not answer", () => {
    expect(giftVisibilityPreviewQuerySchema.safeParse({ visibility: "SECRET", id: "g1" }).success).toBe(
      false,
    );
  });

  it("carries the reservation flag and nothing else", () => {
    expect(giftVisibilityPreviewSchema.parse({ wouldCancelReservation: true })).toEqual({
      wouldCancelReservation: true,
    });
    expect(giftVisibilityPreviewSchema.safeParse({ wouldCancelReservation: "yes" }).success).toBe(false);
    expect(giftVisibilityPreviewSchema.safeParse({ wouldCancelReservation: true, id: "g1" }).success).toBe(
      false,
    );
  });
});

/**
 * Story 5.5 (FR-25, AD-7/AD-12): the holder's reservation card, the list around
 * it and the one-action body of `PATCH /me/reservations/:giftId`.
 */
describe("reservation cards and actions", () => {
  const card = {
    giftId: "g1",
    titleSnapshot: "Наушники",
    status: "RESERVED",
    ownerNick: "anna",
    dueAt: "2026-12-08",
    phase: "ACTIVE",
    bought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    canOpenGift: true,
  };

  it("accepts the closed card and the list around it", () => {
    expect(reservationCardSchema.parse(card)).toEqual(card);
    expect(reservationListSchema.parse({ reservations: [card] })).toEqual({ reservations: [card] });
    expect(reservationListSchema.parse({ reservations: [] })).toEqual({ reservations: [] });
  });

  /** AD-7: the card is a closed set, so no price, tags, visibility or zone leaks in. */
  it("rejects fields outside the card", () => {
    for (const extra of [
      { priceAmount: 100 },
      { visibility: "PUBLIC" },
      { reservationTimeZone: "UTC" },
      { ownerName: "Анна" },
      { listToken: "token" },
    ]) {
      expect(reservationCardSchema.safeParse({ ...card, ...extra }).success).toBe(false);
    }
    expect(reservationListSchema.safeParse({ reservations: [], publicToken: "t" }).success).toBe(false);
  });

  it.each(RESERVATION_PHASES)("accepts the %s phase", (phase) => {
    expect(reservationCardSchema.safeParse({ ...card, phase }).success).toBe(true);
  });

  it("rejects an unknown phase, a non-RESERVED status and an impossible day", () => {
    expect(reservationCardSchema.safeParse({ ...card, phase: "EXPIRED" }).success).toBe(false);
    expect(reservationCardSchema.safeParse({ ...card, status: "CLOSED" }).success).toBe(false);
    expect(reservationCardSchema.safeParse({ ...card, dueAt: "2026-02-31" }).success).toBe(false);
    expect(reservationCardSchema.safeParse({ ...card, dueAt: "2026-12-08T00:00:00.000Z" }).success).toBe(
      false,
    );
  });

  it("requires every field of the closed set", () => {
    for (const field of Object.keys(card)) {
      const withoutField = Object.fromEntries(
        Object.entries(card).filter(([key]) => key !== field),
      );
      expect(reservationCardSchema.safeParse(withoutField).success).toBe(false);
    }
  });

  it.each([
    { action: "extend", dueOn: "2026-12-08" },
    { action: "bought", value: true },
    { action: "visibility", holderVisibleToOwner: true, holderVisibleToOthers: false },
    { action: "visibility", holderVisibleToOthers: false },
  ])("accepts the %j action", (body) => {
    expect(reservationActionBodySchema.parse(body)).toEqual(body);
  });

  it("rejects an extra key or two actions in one body", () => {
    expect(
      reservationActionBodySchema.safeParse({ action: "bought", value: true, dueOn: "2026-12-08" })
        .success,
    ).toBe(false);
    expect(
      reservationActionBodySchema.safeParse({ action: "extend", dueOn: "2026-12-08", value: true })
        .success,
    ).toBe(false);
    expect(
      reservationActionBodySchema.safeParse({
        action: "visibility",
        holderVisibleToOwner: true,
        holderVisibleToOthers: false,
        value: true,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty action, a missing field and an impossible day", () => {
    expect(reservationActionBodySchema.safeParse({}).success).toBe(false);
    expect(reservationActionBodySchema.safeParse({ action: "" }).success).toBe(false);
    expect(reservationActionBodySchema.safeParse({ action: "remove" }).success).toBe(false);
    expect(reservationActionBodySchema.safeParse({ action: "extend" }).success).toBe(false);
    expect(reservationActionBodySchema.safeParse({ action: "extend", dueOn: "2026-02-31" }).success).toBe(
      false,
    );
    expect(reservationActionBodySchema.safeParse({ action: "bought", value: "yes" }).success).toBe(false);
    expect(
      reservationActionBodySchema.safeParse({ action: "visibility", holderVisibleToOwner: true })
        .success,
    ).toBe(false);
    expect(
      reservationActionBodySchema.safeParse({ action: "visibility", holderVisibleToOwner: true, holderVisibleToOthers: false, extra: 1 })
        .success,
    ).toBe(false);
  });

  /** The action body is a flat body: a broken field names itself on the issue path. */
  it("names the offending field on the issue path", () => {
    const dueOn = reservationActionBodySchema.safeParse({ action: "extend", dueOn: "2026-02-31" });
    const holder = reservationActionBodySchema.safeParse({ action: "visibility" });

    expect(dueOn.success).toBe(false);
    if (!dueOn.success) expect(dueOn.error.issues[0]?.path).toEqual(["dueOn"]);
    expect(holder.success).toBe(false);
    if (!holder.success) expect(holder.error.issues[0]?.path).toEqual(["holderVisibleToOthers"]);
  });

  it("tells a missing action apart from a field error", () => {
    const empty = reservationActionBodySchema.safeParse({});
    const unknown = reservationActionBodySchema.safeParse({ action: "remove" });

    expect(empty.success).toBe(false);
    if (!empty.success) expect(empty.error.issues[0]?.path).toEqual(["action"]);
    expect(unknown.success).toBe(false);
    if (!unknown.success) expect(unknown.error.issues[0]?.path).toEqual(["action"]);
  });
});
