import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_NAME = "20261128010000_admin_editorial";
const PREVIOUS_MIGRATION = "20261127110000_notification_date_custom";

function readMigration(): string {
  return readFileSync(
    new URL(`./migrations/${MIGRATION_NAME}/migration.sql`, import.meta.url),
    "utf8",
  );
}

/**
 * CLE-143 (Story 10.1, AD-22): the deploy migration of the ADMIN role and the
 * editorial collections. Prisma models neither the CHECK constraints nor the
 * safe backfill of `User.role`, and no disposable database runs locally, so
 * these assertions keep the file honest until CI applies it.
 */
describe("admin and editorial migration (Story 10.1, AD-22)", () => {
  const sql = readMigration();

  it("runs after the notification migration it builds on", () => {
    // Prisma applies migrations in lexicographic order.
    expect(MIGRATION_NAME > PREVIOUS_MIGRATION).toBe(true);
  });

  it("adds the role with a default so existing accounts stay USER", () => {
    expect(sql).toContain('CREATE TYPE "UserRole" AS ENUM (\'USER\', \'ADMIN\')');
    expect(sql).toContain(
      'ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT \'USER\'',
    );
    // A default on the column is the backfill: no UPDATE of existing rows.
    expect(sql).not.toMatch(/(^|;)\s*UPDATE\b/im);
  });

  it("creates both tables with cascading ideas", () => {
    expect(sql).toContain('CREATE TABLE "EditorialCollection"');
    expect(sql).toContain('"publishedAt" TIMESTAMPTZ(3)');
    expect(sql).toContain('CREATE TABLE "EditorialItem"');
    expect(sql).toContain('"position" INTEGER NOT NULL');
    expect(sql).toContain(
      'CONSTRAINT "EditorialItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "EditorialCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    );
  });

  it("indexes the published read and the item order", () => {
    expect(sql).toContain(
      'CREATE INDEX "EditorialCollection_publishedAt_idx" ON "EditorialCollection"("publishedAt")',
    );
    expect(sql).toContain(
      'CREATE INDEX "EditorialItem_collectionId_position_idx" ON "EditorialItem"("collectionId", "position")',
    );
  });

  it("refuses a blank or over-long title in both tables", () => {
    expect(sql).toContain('CONSTRAINT "EditorialCollection_title_check"');
    expect(sql).toContain('CONSTRAINT "EditorialItem_title_check"');
    expect(sql.match(/char_length\(btrim\("title"\)\) BETWEEN 1 AND 120/g)).toHaveLength(2);
    expect(sql).toContain('"title" VARCHAR(120) NOT NULL');
  });

  it("never drops or rewrites existing data", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|INDEX|CONSTRAINT|TYPE)\b/i);
    expect(sql).not.toMatch(/(^|;)\s*(UPDATE|DELETE FROM|INSERT INTO)\b/im);
  });
});
