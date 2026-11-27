import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_NAME = "20261127110000_notification_date_custom";
const PREVIOUS_MIGRATION = "20261127100000_user_dates";

function readMigration(): string {
  return readFileSync(
    new URL(`./migrations/${MIGRATION_NAME}/migration.sql`, import.meta.url),
    "utf8",
  );
}

/**
 * Story 7.6 (FR-38, AD-23): the in-app notice about a personal date needs its
 * own `NotificationKind`. The reminder journal value came with the user-dates
 * migration, so this deploy migration only extends the notification type.
 */
describe("personal date notification migration (Story 7.6, AD-23)", () => {
  const sql = readMigration();

  it("runs after the user-dates migration it builds on", () => {
    expect(MIGRATION_NAME > PREVIOUS_MIGRATION).toBe(true);
  });

  it("adds DATE_CUSTOM to NotificationKind only", () => {
    expect(sql).toContain('ALTER TYPE "NotificationKind" ADD VALUE \'DATE_CUSTOM\'');
    expect(sql).not.toContain('"ReminderKind"');
  });

  it("never drops or rewrites another object", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|INDEX|CONSTRAINT|TYPE)\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE\b/);
    expect(sql).not.toMatch(/(^|;)\s*(UPDATE|DELETE FROM|INSERT INTO)\b/im);
  });
});
