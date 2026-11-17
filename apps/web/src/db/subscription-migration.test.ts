import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION_NAME = "20261112130000_subscription";
const PREVIOUS_MIGRATION = "20261112120000_user_search_name_normalized";

function readMigration(): string {
  return readFileSync(
    new URL(`./migrations/${MIGRATION_NAME}/migration.sql`, import.meta.url),
    "utf8",
  );
}

/**
 * The circuit breaker behind AD-19 lives in SQL only: Prisma has no unique
 * constraint over a directed pair with a self-edge CHECK. These assertions keep
 * the deploy migration honest while no disposable database runs in CI.
 */
describe("subscription deploy migration (Story 4.6, AD-19)", () => {
  const sql = readMigration();

  it("runs after the search-name migration it builds on", () => {
    // Prisma applies migrations in lexicographic order.
    expect(MIGRATION_NAME > PREVIOUS_MIGRATION).toBe(true);
  });

  it("creates the directed edge with a unique (subscriberId, targetId) key", () => {
    expect(sql).toContain('CREATE TABLE "Subscription"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "Subscription_subscriberId_targetId_key" ON "Subscription"("subscriberId", "targetId")',
    );
    // Directed, not canonical: A→B and B→A are two rows, so no low/high pair.
    expect(sql).not.toMatch(/userLowId|userHighId/);
  });

  it("forbids a self-subscription and cascades with either user", () => {
    expect(sql).toContain(
      'ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pair_check" CHECK ("subscriberId" <> "targetId")',
    );
    expect(sql.match(/ON DELETE CASCADE/g)).toHaveLength(2);
  });

  it("never drops or rewrites another table", () => {
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|INDEX|CONSTRAINT)\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE "(User|Friendship|FriendshipInvite|Block|InviteCooldown)"/);
  });
});
