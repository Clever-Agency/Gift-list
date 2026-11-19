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

/** Executable SQL only: line comments must not satisfy or weaken assertions. */
function executableSql(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .trim();
}

/**
 * CLE-100: historical users without an invite row get one in deploy; the action
 * only reads. These assertions keep the data migration honest while no disposable
 * database runs in CI.
 */
describe("invite link backfill deploy migration (CLE-100, AD-21)", () => {
  const sql = executableSql(readMigration());

  it("runs after the structural invite-link migration", () => {
    expect(MIGRATION_NAME > INVITE_LINK_MIGRATION).toBe(true);
  });

  it("is exactly one INSERT…SELECT with backfill token generation and filter", () => {
    expect(sql.match(/\bINSERT\s+INTO\b/gi)).toHaveLength(1);
    expect(sql).toMatch(
      /INSERT\s+INTO\s+"InviteLink"[\s\S]*\bSELECT\b[\s\S]*replace\(gen_random_uuid\(\)::text,\s*'-',\s*''\)/i,
    );

    const whereClause = sql.match(/WHERE\s+(.+?)\s+ON\s+CONFLICT/i)?.[1]?.trim();
    expect(whereClause).toBe('il."userId" IS NULL');
  });

  it("resolves conflicts with DO NOTHING only", () => {
    expect(sql).toContain('ON CONFLICT ("userId") DO NOTHING');
    expect(sql).not.toMatch(/ON\s+CONFLICT\s*\([^)]+\)\s+DO\s+UPDATE/i);
  });

  it("never mutates schema or other rows in executable SQL", () => {
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bALTER\b/i);
  });
});