import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIXED_TAGS } from "./seed";

const MIGRATION_NAME = "20261106120000_fixed_tags_catalog";
const STRUCTURAL_TAGS_MIGRATION = "20261105120000_tags";

function readMigration(): string {
  return readFileSync(
    new URL(`./migrations/${MIGRATION_NAME}/migration.sql`, import.meta.url),
    "utf8",
  );
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("fixed tags deploy migration", () => {
  const sql = readMigration();

  it("runs after the structural tags migration", () => {
    // Prisma applies migrations in lexicographic order, so the data migration
    // must sort after the one that creates the Tag table.
    expect(MIGRATION_NAME > STRUCTURAL_TAGS_MIGRATION).toBe(true);
  });

  it("inserts exactly the FIXED_TAGS starting catalog", () => {
    for (const tag of FIXED_TAGS) {
      expect(countOccurrences(sql, `'${tag.slug}'`), tag.slug).toBe(1);
      expect(sql).toContain(`'${JSON.stringify(tag.labels)}'::jsonb`);
    }

    const valueRows = sql.match(/^\s*\('[^']+', '[^']+', '/gm) ?? [];
    expect(valueRows).toHaveLength(FIXED_TAGS.length);
    expect(countOccurrences(sql, 'INSERT INTO "Tag"')).toBe(1);
  });

  it("is idempotent and keeps existing ADMIN labels", () => {
    expect(sql).toContain('ON CONFLICT ("slug") DO UPDATE');
    // Existing keys win because the stored object is concatenated last, and the
    // WHERE clause avoids touching updatedAt when nothing actually changes.
    expect(sql).toContain('EXCLUDED."labels" || "Tag"."labels"');
    expect(sql).toContain('WHERE "Tag"."labels" IS DISTINCT FROM');
    expect(sql).toContain('"updatedAt" = NOW()');
  });

  it("never deletes or truncates catalog rows", () => {
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+"Tag"/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDROP\s+TABLE\s+"Tag"/i);
  });
});
