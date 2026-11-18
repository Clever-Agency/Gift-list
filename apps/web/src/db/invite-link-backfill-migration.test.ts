import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_NAME = "20261118163100_invite_link_backfill";
const INVITE_LINK_MIGRATION = "20261116150000_invite_link";

function readMigration(): string {
  return readFileSync(
    new URL(`./migrations/${MIGRATION_NAME}/migration.sql`, import.meta.url),
    "utf8",
  );
}

/**
 * CLE-100: historical users without an invite row get one in deploy; the action
 * only reads. These assertions keep the data migration honest while no disposable
 * database runs in CI.
 */
describe("invite link backfill deploy migration (CLE-100, AD-21)", () => {
  const sql = readMigration();

  it("runs after the structural invite-link migration", () => {
    expect(MIGRATION_NAME > INVITE_LINK_MIGRATION).toBe(true);
  });

  it("inserts a token only for users who still have no link", () => {
    expect(sql).toContain('INSERT INTO "InviteLink"');
    expect(sql).toMatch(/FROM\s+"User"/);
    expect(sql).toMatch(/LEFT JOIN\s+"InviteLink"/);
    expect(sql).toMatch(/WHERE\s+il\."userId"\s+IS\s+NULL/i);
    expect(sql).toContain("replace(gen_random_uuid()::text, '-', '')");
  });

  it("is idempotent and never rewrites an existing token", () => {
    expect(sql).toContain('ON CONFLICT ("userId") DO NOTHING');
    expect(sql).not.toMatch(/\bUPDATE\s+"InviteLink"/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("never drops or rewrites another table", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|INDEX|CONSTRAINT)\b/i);
    expect(sql).not.toMatch(
      /\bALTER TABLE "(User|List|Friendship|FriendshipInvite|Block|Subscription)"/,
    );
  });
});