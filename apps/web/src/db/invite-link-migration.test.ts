import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_NAME = "20261116150000_invite_link";
const PREVIOUS_MIGRATION = "20261112130000_subscription";

function readMigration(): string {
  return readFileSync(
    new URL(`./migrations/${MIGRATION_NAME}/migration.sql`, import.meta.url),
    "utf8",
  );
}

/**
 * AD-21 keeps one immutable invite token per user, and the rule lives in SQL:
 * `"userId"` is the primary key, so a second link cannot exist. These assertions
 * keep the deploy migration honest while no disposable database runs in CI.
 */
describe("invite link deploy migration (Story 4.7.1, AD-21)", () => {
  const sql = readMigration();

  it("runs after the subscription migration it builds on", () => {
    // Prisma applies migrations in lexicographic order.
    expect(MIGRATION_NAME > PREVIOUS_MIGRATION).toBe(true);
  });

  it("holds one link per user with a unique token", () => {
    expect(sql).toContain('CREATE TABLE "InviteLink"');
    expect(sql).toContain('CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("userId")');
    expect(sql).toContain('CREATE UNIQUE INDEX "InviteLink_token_key" ON "InviteLink"("token")');
  });

  it("cascades with the account and never rewrites the token", () => {
    expect(sql).toContain(
      'ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    );
    expect(sql.match(/ON DELETE CASCADE ON UPDATE CASCADE/g)).toHaveLength(1);
    // Immutable: no statement may change an existing row.
    expect(sql).not.toMatch(/UPDATE\s+"InviteLink"|INSERT INTO|DELETE FROM/i);
  });

  it("never drops or rewrites another table and backfills nothing", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|INDEX|CONSTRAINT)\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE "(User|List|Friendship|FriendshipInvite|Block)"/);
  });
});
