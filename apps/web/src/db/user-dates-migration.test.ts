import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_NAME = "20261127100000_user_dates";
const PREVIOUS_MIGRATION = "20261127020000_reminder_log";

function readMigration(): string {
  return readFileSync(
    new URL(`./migrations/${MIGRATION_NAME}/migration.sql`, import.meta.url),
    "utf8",
  );
}

/**
 * AD-23 / Story 7.5: personal dates with two independent visibility switches.
 * Prisma models neither the CHECK constraints nor the new reminder enum value,
 * so these assertions keep the deploy migration honest while no disposable
 * database runs in CI.
 */
describe("user dates deploy migration (Story 7.5, AD-23)", () => {
  const sql = readMigration();

  it("runs after the reminder log migration it builds on", () => {
    // Prisma applies migrations in lexicographic order.
    expect(MIGRATION_NAME > PREVIOUS_MIGRATION).toBe(true);
  });

  it("creates both closed enums and the table", () => {
    expect(sql).toContain('CREATE TYPE "UserDateKind" AS ENUM (\'CUSTOM\')');
    expect(sql).toContain(
      'CREATE TYPE "DateVisibility" AS ENUM (\'ONLY_ME\', \'FRIENDS\', \'EVERYONE\')',
    );
    expect(sql).toContain('CREATE TABLE "UserDate"');
    expect(sql).toContain('"kind" "UserDateKind" NOT NULL DEFAULT \'CUSTOM\'');
    expect(sql).toContain('"visibility" "DateVisibility" NOT NULL DEFAULT \'FRIENDS\'');
    expect(sql).toContain('"yearVisibility" "DateVisibility" NOT NULL DEFAULT \'ONLY_ME\'');
    expect(sql).toContain('"year" INTEGER,');
  });

  it("cascades with the account and indexes the owner", () => {
    expect(sql).toContain(
      'CONSTRAINT "UserDate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    expect(sql.match(/ON DELETE CASCADE ON UPDATE CASCADE/g)).toHaveLength(1);
    expect(sql).toContain('CREATE INDEX "UserDate_userId_idx" ON "UserDate"("userId")');
  });

  it("refuses a blank title and a day outside the stored month", () => {
    expect(sql).toContain('CONSTRAINT "UserDate_title_check"');
    expect(sql).toContain('char_length(btrim("title")) BETWEEN 1 AND 40');
    expect(sql).toContain('CONSTRAINT "UserDate_day_month_check"');
    expect(sql).toContain('"month" BETWEEN 1 AND 12');
    expect(sql).toContain('WHEN 4 THEN 30');
    expect(sql).toContain('WHEN 11 THEN 30');
  });

  it("applies the leap rule only when a year is stored", () => {
    // Without a year February stops at 29, so 29 February is a valid date;
    // with a year the leap rule decides.
    expect(sql).toContain('WHEN "year" IS NULL THEN 29');
    expect(sql).toContain('"year" % 4 = 0 AND "year" % 100 <> 0');
    expect(sql).toContain('"year" % 400 = 0');
    expect(sql).toContain('CONSTRAINT "UserDate_year_check"');
    expect(sql).toContain('"year" BETWEEN 1900 AND 9999');
  });

  it("adds DATE_CUSTOM to ReminderKind for Story 7.6 and uses no new value", () => {
    expect(sql.match(/DATE_CUSTOM/g)).toHaveLength(1);
    expect(sql).toContain('ALTER TYPE "ReminderKind" ADD VALUE \'DATE_CUSTOM\'');
  });

  it("never drops or rewrites another table", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|INDEX|CONSTRAINT|TYPE)\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE "(User|Gift|List|Friendship|Block|ReminderLog)"/);
    expect(sql).not.toMatch(/(^|;)\s*(UPDATE|DELETE FROM|INSERT INTO)\b/im);
  });
});
