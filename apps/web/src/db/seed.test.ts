import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@gift-list/contracts";
import { FIXED_TAGS, seedFixedTags, type SeedQuery } from "./seed";

type SeededRow = { id: string; labels: string };

function createFakeDb() {
  const rowsBySlug = new Map<string, SeededRow>();
  const statements: string[] = [];
  // Mirrors the SQL: existing labels win, the seed only fills missing keys.
  const query: SeedQuery = async function upsertBySlug(sql, values) {
    statements.push(sql);
    const [id, slug, labelJson] = values as [string, string, string];
    const existing = rowsBySlug.get(slug);
    const seeded = JSON.parse(labelJson) as Record<string, string>;
    const stored = existing ? (JSON.parse(existing.labels) as Record<string, string>) : {};
    rowsBySlug.set(slug, {
      id: existing?.id ?? id,
      labels: JSON.stringify({ ...seeded, ...stored }),
    });
  };

  return { rowsBySlug, statements, query };
}

describe("FIXED_TAGS", () => {
  it("defines exactly the three starting tags with stable slugs", () => {
    expect(FIXED_TAGS.map((tag) => tag.slug)).toEqual(["dream", "need-now", "someday"]);
  });

  it("has the expected Russian labels", () => {
    expect(Object.fromEntries(FIXED_TAGS.map((tag) => [tag.slug, tag.labels.ru]))).toEqual({
      dream: "мечта",
      "need-now": "нужно сейчас",
      someday: "когда-нибудь",
    });
  });

  it("has a non-empty label for every supported locale", () => {
    for (const tag of FIXED_TAGS) {
      const labels: Readonly<Record<string, string>> = tag.labels;
      for (const locale of SUPPORTED_LOCALES) {
        expect(typeof labels[locale], `${tag.slug}/${locale}`).toBe("string");
        expect(labels[locale]?.trim()).not.toBe("");
      }
    }
  });
});

describe("seedFixedTags", () => {
  it("is idempotent: rerunning upserts by slug without duplicates", async () => {
    const db = createFakeDb();

    await seedFixedTags(db.query);
    const idsAfterFirstRun = new Map(
      [...db.rowsBySlug].map(([slug, row]) => [slug, row.id]),
    );

    await seedFixedTags(db.query);

    expect([...db.rowsBySlug.keys()].sort()).toEqual(["dream", "need-now", "someday"]);
    for (const [slug, row] of db.rowsBySlug) {
      expect(row.id).toBe(idsAfterFirstRun.get(slug));
    }
    expect(db.statements).toHaveLength(6);
    for (const statement of db.statements) {
      expect(statement).toContain('ON CONFLICT ("slug") DO UPDATE');
    }
  });

  it("writes the localized labels as JSON for every tag", async () => {
    const db = createFakeDb();

    await seedFixedTags(db.query);

    for (const tag of FIXED_TAGS) {
      expect(JSON.parse(db.rowsBySlug.get(tag.slug)?.labels ?? "null")).toEqual(tag.labels);
    }
  });

  it("keeps an ADMIN-edited label on rerun", async () => {
    const db = createFakeDb();
    await seedFixedTags(db.query);

    db.rowsBySlug.set("dream", {
      id: "existing",
      labels: JSON.stringify({ ru: "мечта администратора" }),
    });

    await seedFixedTags(db.query);

    expect(JSON.parse(db.rowsBySlug.get("dream")?.labels ?? "null")).toEqual({
      ru: "мечта администратора",
    });
  });
});
