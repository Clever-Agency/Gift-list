import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_NAME = "20261128020000_custom_tag_moderation";
const PREVIOUS_MIGRATION = "20261128010000_admin_editorial";

function readMigration(): string {
  return readFileSync(
    new URL(`./migrations/${MIGRATION_NAME}/migration.sql`, import.meta.url),
    "utf8",
  );
}

/**
 * CLE-144 (Story 10.2, AD-22): the deploy migration of the custom tag moderation
 * decisions. Prisma models none of the CHECK constraints, and no disposable
 * database runs locally, so these assertions keep the file honest until CI
 * applies it to a temporary PostgreSQL.
 */
describe("custom tag moderation migration (Story 10.2, AD-22)", () => {
  const sql = readMigration();

  it("runs after the admin and editorial migration it builds on", () => {
    expect(MIGRATION_NAME > PREVIOUS_MIGRATION).toBe(true);
  });

  it("creates the decision enum and one table keyed by the normalized text", () => {
    expect(sql).toContain('CREATE TYPE "CustomTagDecision" AS ENUM (\'APPROVED\', \'REJECTED\')');
    expect(sql).toContain('CREATE TABLE "CustomTagModeration"');
    expect(sql).toContain('"normalizedText" TEXT NOT NULL');
    expect(sql).toContain('"decision" "CustomTagDecision" NOT NULL');
    expect(sql).toContain('"tagId" TEXT');
    expect(sql).toContain('"decidedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "CustomTagModeration_normalizedText_key" ON "CustomTagModeration"("normalizedText")',
    );
  });

  it("points an approved decision at a catalog tag and keeps that tag alive", () => {
    expect(sql).toContain(
      'CONSTRAINT "CustomTagModeration_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    );
    expect(sql).toContain(
      'CREATE INDEX "CustomTagModeration_tagId_idx" ON "CustomTagModeration"("tagId")',
    );
  });

  it("requires a tag for approval, forbids it for rejection and refuses a blank key", () => {
    expect(sql).toContain('CONSTRAINT "CustomTagModeration_shape_check"');
    expect(sql).toContain('btrim("normalizedText") <> \'\'');
    expect(sql).toContain('("decision" = \'APPROVED\' AND "tagId" IS NOT NULL)');
    expect(sql).toContain('("decision" = \'REJECTED\' AND "tagId" IS NULL)');
  });

  it("never drops or rewrites existing data", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|INDEX|CONSTRAINT|TYPE)\b/i);
    expect(sql).not.toMatch(/(^|;)\s*(UPDATE|DELETE FROM|INSERT INTO)\b/im);
    expect(sql).not.toMatch(/\bALTER TABLE "(GiftTag|Tag|Gift)"/);
  });
});
