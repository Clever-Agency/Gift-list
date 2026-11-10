/**
 * F5 / Q-04: verification against a disposable PostgreSQL instance.
 *
 * This file is NOT part of `npm test`: `vitest.config.ts` collects only
 * `src/**\/*.test.{ts,tsx}`, while this file is matched by
 * `vitest.pg.config.ts` and the `verify:disposable-pg` script. Running it
 * without a safe target fails at `resolveDisposableTarget()` before any
 * connection; it never falls back to `DATABASE_URL`/`DIRECT_URL` or
 * `apps/web/.env`.
 *
 * Required process-local environment (PowerShell example, no `.env` edit):
 *
 *   $env:DISPOSABLE_DATABASE_URL = "postgresql://f5:secret@127.0.0.1:55432/gift_f5_abc12345"
 *   $env:DISPOSABLE_DIRECT_URL   = $env:DISPOSABLE_DATABASE_URL
 *   $env:DISPOSABLE_PG_CONFIRM   = "gift_f5_abc12345"
 *   npm run verify:disposable-pg -w @gift-list/web
 *
 * The database must be new and empty; the run proves that before migrating.
 * Evidence is written next to the other fixup artifacts, without credentials.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { toGiftTags } from "../../domain/tag";
import { createGift } from "../../actions/gifts";
import { Prisma, PrismaClient } from "../generated/client";
import {
  describeDisposableTarget,
  DisposablePgRefusal,
  resolveDisposableTarget,
  type DisposableTarget,
} from "./guard";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

const WEB_DIR = fileURLToPath(new URL("../../../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const PRISMA_CLI = join(REPO_ROOT, "node_modules", "prisma", "build", "index.js");
const EVIDENCE_DIR = join(
  REPO_ROOT,
  "_bmad-output",
  "implementation-artifacts",
  "opencode-microtasks",
);
const STRUCTURAL_TAGS_MIGRATION = "20261105120000_tags";
const CATALOG_MIGRATION = "20261106120000_fixed_tags_catalog";

// Resolved in `beforeAll`; a refusal is printed before the suite fails so the
// operator sees the exact reason instead of a bare "no tests".
let target!: DisposableTarget;

function resolveTargetOrReport(): DisposableTarget {
  try {
    return resolveDisposableTarget();
  } catch (error) {
    if (error instanceof DisposablePgRefusal) {
      console.error(`\n${error.message}\n`);
      console.error(
        "Set DISPOSABLE_DATABASE_URL, DISPOSABLE_DIRECT_URL and DISPOSABLE_PG_CONFIRM " +
          "for a new, empty, loopback database. See the header of verify.pgtest.ts.",
      );
    }
    throw error;
  }
}

let client!: Client;
let pool!: Pool;
let prisma!: PrismaClient;
let tempDir = "";
let serverVersion = "";
let systemIdentifier = "";
const evidence: string[] = [];

function record(line: string): void {
  evidence.push(`- ${line}`);
}

function scrub(text: string): string {
  return text.split(target.password).join("***");
}

type ServerIdentity = {
  database: string;
  user: string;
  version: string;
  systemIdentifier: string;
};

/**
 * `inet_server_addr()` reports the server-side socket address, which behind a
 * Docker published port is the container bridge address, not loopback. The
 * loopback guarantee therefore comes from the validated connection string and
 * from the client's actual connection parameters, while the cluster system
 * identifier proves that the migration hit the same server that was checked
 * empty.
 */
async function readServerIdentity(): Promise<ServerIdentity> {
  const result = await client.query<{
    database: string;
    user: string;
    version: string;
    systemIdentifier: string;
  }>(
    `SELECT current_database() AS database,
            current_user AS "user",
            current_setting('server_version') AS version,
            (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier"`,
  );
  return (
    result.rows[0] ?? { database: "", user: "", version: "", systemIdentifier: "" }
  );
}

function expectLoopbackClient(label: string): void {
  // `connectionParameters` exists at runtime but is not part of the published
  // `@types/pg` surface, so read it through a narrow local shape.
  const connection = (
    client as unknown as {
      connectionParameters?: { host?: string; port?: number; database?: string };
    }
  ).connectionParameters;
  expect(connection?.host, `${label}: client host`).toBe(target.host);
  expect(Number(connection?.port), `${label}: client port`).toBe(target.port);
  expect(connection?.database, `${label}: client database`).toBe(target.database);
  record(`${label}: client connection ${target.host}:${target.port}/${target.database}`);
}

function runPrisma(args: readonly string[]): string {
  const result = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: WEB_DIR,
    env: {
      ...process.env,
      // Process-local overrides only; dotenv is pointed at an empty file so a
      // repository .env cannot supply or override the target.
      DATABASE_URL: target.databaseUrl,
      DIRECT_URL: target.directUrl,
      DOTENV_CONFIG_PATH: join(tempDir, "empty.env"),
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    },
    encoding: "utf8",
    timeout: 240_000,
  });

  const output = scrub(`${result.stdout ?? ""}${result.stderr ?? ""}`.trim());
  if (result.status !== 0) {
    throw new Error(
      `prisma ${args.join(" ")} exited with ${String(result.status)}\n${output}`,
    );
  }

  record(`prisma ${args.join(" ")}: exit 0`);
  return output;
}

async function countRows(table: "Tag" | "GiftTag"): Promise<number> {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM "${table}"`,
  );
  return result.rows[0]?.count ?? -1;
}

/**
 * The AD-7 guard forbids `gift.count()` outside the gated read; these probes
 * only support the disposable run and use plain SQL instead.
 */
async function countGifts(): Promise<number> {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM "Gift"`,
  );
  return result.rows[0]?.count ?? -1;
}

async function readGiftTitle(giftId: string): Promise<string> {
  const result = await client.query<{ title: string }>(
    `SELECT "title" FROM "Gift" WHERE "id" = $1`,
    [giftId],
  );
  return result.rows[0]?.title ?? "";
}

async function createGiftFixture(title: string): Promise<{ giftId: string; listId: string }> {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const user = await prisma.user.create({
    data: {
      name: "F5",
      email: `${suffix}@f5.invalid`,
      nick: `f5${suffix}`,
      nickNormalized: `f5${suffix}`,
    },
  });
  const list = await prisma.list.create({
    data: { ownerId: user.id, publicToken: `f5${suffix}` },
  });
  const gift = await prisma.gift.create({ data: { listId: list.id, title } });
  return { giftId: gift.id, listId: list.id };
}

/** A user and their list without a gift, for the R1 action-level probes. */
async function createOwnerFixture(): Promise<{ userId: string; listId: string }> {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const user = await prisma.user.create({
    data: {
      name: "F4",
      email: `${suffix}@f4.invalid`,
      nick: `f4${suffix}`,
      nickNormalized: `f4${suffix}`,
    },
  });
  const list = await prisma.list.create({
    data: { ownerId: user.id, publicToken: `f4${suffix}` },
  });
  return { userId: user.id, listId: list.id };
}

/** Prisma 7.10 + adapter-pg keeps the PostgreSQL constraint only in this cause. */
function constraintIndex(error: unknown): string {
  const meta = (error as { meta?: { driverAdapterError?: { cause?: { constraint?: { index?: unknown } } } } })
    .meta;
  const index = meta?.driverAdapterError?.cause?.constraint?.index;
  return typeof index === "string" ? index : "";
}

async function dropGiftTrigger(trigger: string, fn: string): Promise<void> {
  await client.query(`DROP TRIGGER IF EXISTS "${trigger}" ON "Gift"`);
  await client.query(`DROP FUNCTION IF EXISTS "${fn}"()`);
}

async function expectPostgresError(
  sql: string,
  values: readonly unknown[],
  code: string,
): Promise<void> {
  try {
    await client.query(sql, [...values]);
  } catch (error) {
    expect((error as { code?: string }).code, sql).toBe(code);
    return;
  }
  throw new Error(`expected PostgreSQL error ${code} for: ${sql}`);
}

async function expectPrismaError(operation: Promise<unknown>, code: string): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe(code);
    return;
  }
  throw new Error(`expected Prisma error ${code}`);
}

describe.sequential("disposable PostgreSQL verification (F5 / Q-04)", () => {
  beforeAll(async () => {
    target = resolveTargetOrReport();
    // Process-local override for the action's shared client; the guard never
    // reads these, and child Prisma processes get explicit overrides below.
    process.env.DATABASE_URL = target.databaseUrl;
    process.env.DIRECT_URL = target.directUrl;
    tempDir = mkdtempSync(join(tmpdir(), "gift-list-f5-"));
    writeFileSync(join(tempDir, "empty.env"), "");
    record(`target: ${describeDisposableTarget(target)}`);
    record(`suite: vitest ${process.platform}/${process.arch}`);

    client = new Client({ connectionString: target.directUrl });
    await client.connect();

    const identity = await client.query<{
      database: string;
      address: string | null;
      user: string;
      version: string;
    }>(
      `SELECT current_database() AS database,
              inet_server_addr()::text AS address,
              current_user AS "user",
              current_setting('server_version') AS version`,
    );
    const row = identity.rows[0];
    expect(row?.database).toBe(target.database);
    expectLoopbackClient("preflight");

    serverVersion = row?.version ?? "";
    record(`server: PostgreSQL ${serverVersion}, connected as ${row?.user ?? "?"}`);
    record(`server-side socket address (informational): ${row?.address ?? "unix socket"}`);

    const serverIdentity = await readServerIdentity();
    expect(serverIdentity.database).toBe(target.database);
    expect(serverIdentity.systemIdentifier).not.toBe("");
    systemIdentifier = serverIdentity.systemIdentifier;
    record(`cluster system identifier: ${systemIdentifier}`);

    // Proven empty before the first migration: no user tables at all.
    const empty = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')`,
    );
    expect(empty.rows[0]?.count, "target must have no tables before migrate").toBe(0);
    record("preflight: 0 user tables, target is empty");

    runPrisma(["migrate", "deploy"]);

    const afterMigrate = await client.query<{ database: string; address: string | null }>(
      `SELECT current_database() AS database, inet_server_addr()::text AS address`,
    );
    expect(afterMigrate.rows[0]?.database).toBe(target.database);
    expectLoopbackClient("post-migrate");
    const identityAfterMigrate = await readServerIdentity();
    expect(identityAfterMigrate.systemIdentifier).toBe(systemIdentifier);
    record("post-migrate identity: same disposable database and cluster (no env fallback)");

    pool = new Pool({ connectionString: target.databaseUrl, max: 4 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  }, 300_000);

  afterAll(async () => {
    try {
      await prisma?.$disconnect();
    } catch {
      // The adapter may already have closed its pool.
    }
    try {
      await pool?.end();
    } catch {
      // Ignore a double close: the evidence below still reflects the run.
    }
    try {
      await client?.end();
    } catch {
      // Ignore a double close.
    }

    if (evidence.length === 0) return;
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(":", "").replace(/\..+$/, "");
    const path = join(EVIDENCE_DIR, `fixup-F5-evidence-${stamp}.md`);
    const body = [
      "# F5 / Q-04 — evidence from a disposable PostgreSQL",
      "",
      `Run: ${new Date().toISOString()}`,
      `Target: ${describeDisposableTarget(target)}`,
      `PostgreSQL: ${serverVersion}`,
      "",
      "This evidence is valid only for the disposable target above. It is not a",
      "check of any live, shared or production database.",
      "",
      ...evidence,
      "",
    ].join("\n");
    writeFileSync(path, body, "utf8");
    console.log(`F5 evidence: ${path}`);
  }, 60_000);

  it("applies both tag migrations and records them as finished", async () => {
    const result = await client.query<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>(
      `SELECT migration_name, finished_at, rolled_back_at
         FROM "_prisma_migrations"
        ORDER BY migration_name`,
    );

    const names = result.rows.map(function migrationName(row) {
      return row.migration_name;
    });
    expect(names).toEqual(
      expect.arrayContaining([STRUCTURAL_TAGS_MIGRATION, CATALOG_MIGRATION]),
    );
    for (const migration of result.rows) {
      expect(migration.finished_at, migration.migration_name).not.toBeNull();
      expect(migration.rolled_back_at, migration.migration_name).toBeNull();
    }

    record(`migrations: ${names.join(", ")}`);
  });

  it("seeds the fixed catalog through the deploy migration", async () => {
    const rows = await client.query<{ slug: string; labels: unknown }>(
      `SELECT "slug", "labels" FROM "Tag" ORDER BY "slug"`,
    );

    expect(rows.rows).toEqual([
      { slug: "dream", labels: { ru: "мечта" } },
      { slug: "need-now", labels: { ru: "нужно сейчас" } },
      { slug: "someday", labels: { ru: "когда-нибудь" } },
    ]);
    record(`catalog rows: ${rows.rows.map(function slug(row) { return row.slug; }).join(", ")}`);
  });

  it("runs a second migrate deploy as a no-op", async () => {
    const before = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "_prisma_migrations"`,
    );
    const tagsBefore = await countRows("Tag");

    runPrisma(["migrate", "deploy"]);

    const after = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "_prisma_migrations"`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
    expect(await countRows("Tag")).toBe(tagsBefore);
    record("second deploy: migration history and catalog unchanged");
  });

  it("reruns the seed idempotently without new rows or ids", async () => {
    const before = await client.query<{ id: string; slug: string }>(
      `SELECT "id", "slug" FROM "Tag" ORDER BY "slug"`,
    );

    runPrisma(["db", "seed"]);
    runPrisma(["db", "seed"]);

    const after = await client.query<{ id: string; slug: string }>(
      `SELECT "id", "slug" FROM "Tag" ORDER BY "slug"`,
    );
    expect(after.rows).toEqual(before.rows);
    expect(await countRows("Tag")).toBe(3);
    record("seed twice: 3 rows, same ids");
  });

  it("enforces the Tag labels object CHECK", async () => {
    const list = await createGiftFixture("check labels");
    expect(list.giftId).toBeTruthy();

    const tag = await client.query<{ id: string }>(
      `SELECT "id" FROM "Tag" WHERE "slug" = 'dream'`,
    );
    const dreamId = tag.rows[0]?.id ?? "";

    await expectPostgresError(
      `INSERT INTO "Tag" ("id", "slug", "labels", "updatedAt")
       VALUES ($1, $2, '[]'::jsonb, NOW())`,
      [`tag_${randomUUID()}`, `chk_${randomUUID()}`],
      "23514",
    );
    await expectPostgresError(
      `UPDATE "Tag" SET "labels" = 'null'::jsonb WHERE "id" = $1`,
      [dreamId],
      "23514",
    );
    record("Tag_labels_object_check: array and null rejected (23514)");
  });

  it("enforces the GiftTag shape CHECK", async () => {
    const { giftId } = await createGiftFixture("check gift tag shape");

    await expectPostgresError(
      `INSERT INTO "GiftTag" ("id", "giftId", "tagId", "customText", "aggregateEligible")
       VALUES ($1, $2, NULL, NULL, false)`,
      [`gt_${randomUUID()}`, giftId],
      "23514",
    );
    await expectPostgresError(
      `INSERT INTO "GiftTag" ("id", "giftId", "tagId", "customText", "aggregateEligible")
       VALUES ($1, $2, NULL, '   ', false)`,
      [`gt_${randomUUID()}`, giftId],
      "23514",
    );
    await expectPostgresError(
      `INSERT INTO "GiftTag" ("id", "giftId", "tagId", "customText", "aggregateEligible")
       VALUES ($1, $2, NULL, 'не в каталоге', true)`,
      [`gt_${randomUUID()}`, giftId],
      "23514",
    );
    record("GiftTag_shape_check: no identity, blank text, eligible without tag rejected");
  });

  it("enforces the Tag and GiftTag unique indexes", async () => {
    const slug = `uniq_${randomUUID()}`;
    const tagId = `tag_${randomUUID()}`;
    await client.query(
      `INSERT INTO "Tag" ("id", "slug", "labels", "updatedAt")
       VALUES ($1, $2, '{"ru":"уникальный"}'::jsonb, NOW())`,
      [tagId, slug],
    );
    await expectPostgresError(
      `INSERT INTO "Tag" ("id", "slug", "labels", "updatedAt")
       VALUES ($1, $2, '{"ru":"дубль"}'::jsonb, NOW())`,
      [`tag_${randomUUID()}`, slug],
      "23505",
    );

    const { giftId } = await createGiftFixture("unique gift tags");
    await client.query(
      `INSERT INTO "GiftTag" ("id", "giftId", "tagId", "aggregateEligible")
       VALUES ($1, $2, $3, true)`,
      [`gt_${randomUUID()}`, giftId, tagId],
    );
    await expectPostgresError(
      `INSERT INTO "GiftTag" ("id", "giftId", "tagId", "aggregateEligible")
       VALUES ($1, $2, $3, true)`,
      [`gt_${randomUUID()}`, giftId, tagId],
      "23505",
    );
    await client.query(
      `INSERT INTO "GiftTag" ("id", "giftId", "customText", "aggregateEligible")
       VALUES ($1, $2, 'своё', false)`,
      [`gt_${randomUUID()}`, giftId],
    );
    await expectPostgresError(
      `INSERT INTO "GiftTag" ("id", "giftId", "customText", "aggregateEligible")
       VALUES ($1, $2, 'своё', false)`,
      [`gt_${randomUUID()}`, giftId],
      "23505",
    );
    record("unique: duplicate slug and duplicate (giftId, tagId|customText) rejected (23505)");

    await client.query(`DELETE FROM "GiftTag" WHERE "giftId" = $1`, [giftId]);
    await client.query(`DELETE FROM "Tag" WHERE "id" = $1`, [tagId]);
  });

  it("keeps ON DELETE RESTRICT for a referenced catalog tag", async () => {
    const tagId = `tag_${randomUUID()}`;
    const slug = `restrict_${randomUUID()}`;
    await client.query(
      `INSERT INTO "Tag" ("id", "slug", "labels", "updatedAt")
       VALUES ($1, $2, '{"ru":"не удалять"}'::jsonb, NOW())`,
      [tagId, slug],
    );
    const { giftId } = await createGiftFixture("restrict tag delete");
    const giftTagId = `gt_${randomUUID()}`;
    await client.query(
      `INSERT INTO "GiftTag" ("id", "giftId", "tagId", "aggregateEligible")
       VALUES ($1, $2, $3, true)`,
      [giftTagId, giftId, tagId],
    );

    await expectPostgresError(`DELETE FROM "Tag" WHERE "id" = $1`, [tagId], "23503");

    await client.query(`DELETE FROM "GiftTag" WHERE "id" = $1`, [giftTagId]);
    await client.query(`DELETE FROM "Tag" WHERE "id" = $1`, [tagId]);
    record("GiftTag_tagId_fkey: deleting a referenced tag rejected (23503), then cleaned up");
  });

  it("writes a gift with nested tag rows atomically", async () => {
    const { listId } = await createGiftFixture("nested create base");
    const dream = await client.query<{ id: string }>(
      `SELECT "id" FROM "Tag" WHERE "slug" = 'dream'`,
    );
    const dreamId = dream.rows[0]?.id ?? "";
    const gift = await prisma.gift.create({
      data: {
        listId,
        title: "nested create",
        tags: {
          create: [
            { tagId: dreamId, aggregateEligible: true },
            { customText: "своё", aggregateEligible: false },
          ],
        },
      },
      include: { tags: true },
    });

    expect(gift.tags).toHaveLength(2);
    const fixed = gift.tags.find(function byTagId(row) {
      return row.tagId === dreamId;
    });
    const custom = gift.tags.find(function byCustomText(row) {
      return row.customText === "своё";
    });
    expect(fixed?.aggregateEligible).toBe(true);
    expect(custom?.aggregateEligible).toBe(false);

    const giftsBefore = await countGifts();
    await expectPrismaError(
      prisma.gift.create({
        data: {
          listId,
          title: "nested create with a missing tag",
          tags: { create: [{ tagId: `missing_${randomUUID()}`, aggregateEligible: true }] },
        },
      }),
      "P2003",
    );
    expect(await countGifts()).toBe(giftsBefore);
    record("nested create: 2 rows; missing catalog id -> P2003 with no gift left behind");
  });

  it("rolls back an interactive transaction and commits the next one", async () => {
    const { giftId } = await createGiftFixture("transaction probe");
    const someday = await client.query<{ id: string }>(
      `SELECT "id" FROM "Tag" WHERE "slug" = 'someday'`,
    );
    const somedayId = someday.rows[0]?.id ?? "";
    const tagsBefore = await prisma.giftTag.count({ where: { giftId } });

    await expect(
      prisma.$transaction(async function failingTransaction(tx) {
        await tx.gift.update({
          where: { id: giftId },
          data: { title: "must be rolled back" },
        });
        await tx.giftTag.createMany({
          data: [{ giftId, tagId: somedayId, aggregateEligible: true }],
        });
        throw new Error("F5 rollback probe");
      }),
    ).rejects.toThrow("F5 rollback probe");

    const afterRollback = await readGiftTitle(giftId);
    expect(afterRollback).toBe("transaction probe");
    expect(await prisma.giftTag.count({ where: { giftId } })).toBe(tagsBefore);

    await prisma.$transaction(async function commitTransaction(tx) {
      await tx.gift.update({ where: { id: giftId }, data: { title: "committed" } });
      await tx.giftTag.createMany({
        data: [{ giftId, tagId: somedayId, aggregateEligible: true }],
      });
    });
    expect(await readGiftTitle(giftId)).toBe("committed");
    expect(await prisma.giftTag.count({ where: { giftId } })).toBe(tagsBefore + 1);
    record("$transaction: field and tag writes rolled back together; committed run persisted");
  });

  it("writes tag rows with createMany and rejects a duplicate batch", async () => {
    const { giftId } = await createGiftFixture("createMany probe");
    const tags = await client.query<{ id: string; slug: string }>(
      `SELECT "id", "slug" FROM "Tag" WHERE "slug" IN ('dream', 'someday') ORDER BY "slug"`,
    );
    const rows = tags.rows.map(function toCreateRow(row) {
      return { giftId, tagId: row.id, aggregateEligible: true };
    });

    await prisma.giftTag.createMany({ data: rows });
    expect(await prisma.giftTag.count({ where: { giftId } })).toBe(2);

    await expectPrismaError(prisma.giftTag.createMany({ data: rows }), "P2002");
    expect(await prisma.giftTag.count({ where: { giftId } })).toBe(2);
    record("createMany: 2 rows; duplicate batch -> P2002 with no extra row");
  });

  it("lets exactly one concurrent writer win a GiftTag unique index", async () => {
    const { giftId } = await createGiftFixture("unique race");
    const dream = await client.query<{ id: string }>(
      `SELECT "id" FROM "Tag" WHERE "slug" = 'dream'`,
    );
    const dreamId = dream.rows[0]?.id ?? "";

    const results = await Promise.allSettled([
      prisma.$transaction(async function firstWriter(tx) {
        await tx.giftTag.create({
          data: { giftId, tagId: dreamId, aggregateEligible: true },
        });
      }),
      prisma.$transaction(async function secondWriter(tx) {
        await tx.giftTag.create({
          data: { giftId, tagId: dreamId, aggregateEligible: true },
        });
      }),
    ]);

    const fulfilled = results.filter(function isFulfilled(result) {
      return result.status === "fulfilled";
    });
    const rejected = results.filter(function isRejected(result) {
      return result.status === "rejected";
    });
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const failure = rejected[0] as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((failure.reason as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");
    expect(await prisma.giftTag.count({ where: { giftId, tagId: dreamId } })).toBe(1);
    record("race: one insert committed, the other failed with P2002, one row total");
  });

  it("keeps the FK invariant when delete and insert race", async () => {
    const tagId = `tag_${randomUUID()}`;
    const slug = `race_${randomUUID()}`;
    await client.query(
      `INSERT INTO "Tag" ("id", "slug", "labels", "updatedAt")
       VALUES ($1, $2, '{"ru":"гонка"}'::jsonb, NOW())`,
      [tagId, slug],
    );
    const { giftId } = await createGiftFixture("delete insert race");

    const results = await Promise.allSettled([
      prisma.$transaction(async function deleteTag(tx) {
        await tx.tag.delete({ where: { id: tagId } });
      }),
      prisma.$transaction(async function linkTag(tx) {
        await tx.giftTag.create({
          data: { giftId, tagId, aggregateEligible: true },
        });
      }),
    ]);

    expect(
      results.filter(function isRejected(result) {
        return result.status === "rejected";
      }).length,
    ).toBeGreaterThanOrEqual(1);

    const orphans = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM "GiftTag" gt
         LEFT JOIN "Tag" t ON t."id" = gt."tagId"
        WHERE gt."tagId" IS NOT NULL AND t."id" IS NULL`,
    );
    expect(orphans.rows[0]?.count).toBe(0);
    record("delete/insert race: at least one side rejected, zero orphan GiftTag rows");

    await client.query(`DELETE FROM "GiftTag" WHERE "tagId" = $1`, [tagId]);
    await client.query(`DELETE FROM "Tag" WHERE "id" = $1`, [tagId]);
  });

  it("orders card tags custom text first, then slug, with stored labels", async () => {
    const { giftId } = await createGiftFixture("card order");
    const tags = await client.query<{ id: string; slug: string }>(
      `SELECT "id", "slug" FROM "Tag" ORDER BY "slug"`,
    );
    const bySlug = new Map(
      tags.rows.map(function entry(row) {
        return [row.slug, row.id];
      }),
    );
    await prisma.giftTag.createMany({
      data: [
        { giftId, customText: "яблоко", aggregateEligible: false },
        { giftId, tagId: bySlug.get("someday"), aggregateEligible: true },
        { giftId, customText: "apple", aggregateEligible: false },
        { giftId, tagId: bySlug.get("dream"), aggregateEligible: true },
      ],
    });

    const rows = await prisma.giftTag.findMany({
      where: { giftId },
      select: {
        tagId: true,
        customText: true,
        tag: { select: { slug: true, labels: true } },
      },
    });
    const ordered = toGiftTags(rows, "ru").map(function label(tag) {
      return tag.label;
    });

    expect(ordered).toEqual(["apple", "яблоко", "мечта", "когда-нибудь"]);
    record(`card order: ${ordered.join(" | ")}`);
  });

  it("keeps ADMIN labels and fills a missing locale on reseed", async () => {
    await client.query(
      `UPDATE "Tag" SET "labels" = '{"ru":"мечта ADMIN","en":"Dream"}'::jsonb WHERE "slug" = 'dream'`,
    );
    await client.query(
      `UPDATE "Tag" SET "labels" = '{"en":"Someday"}'::jsonb WHERE "slug" = 'someday'`,
    );

    runPrisma(["db", "seed"]);
    runPrisma(["db", "seed"]);

    const rows = await client.query<{ slug: string; labels: Record<string, string> }>(
      `SELECT "slug", "labels" FROM "Tag" WHERE "slug" IN ('dream', 'someday') ORDER BY "slug"`,
    );
    expect(rows.rows).toEqual([
      { slug: "dream", labels: { ru: "мечта ADMIN", en: "Dream" } },
      { slug: "someday", labels: { ru: "когда-нибудь", en: "Someday" } },
    ]);
    expect(await countRows("Tag")).toBe(3);
    record("reseed: ADMIN ru label kept, en kept, missing ru filled from the seed");
  });

  /**
   * R1/F4: the mapper must read the constraint from the adapter cause, because
   * the root `modelName` of a nested create is `Gift`, not `GiftTag`.
   */
  it("records the real adapter meta for a nested create with a missing tag", async () => {
    const { listId } = await createOwnerFixture();
    const title = `F4 meta ${randomUUID()}`;
    const giftsBefore = await countGifts();
    let caught: unknown;

    try {
      await prisma.gift.create({
        data: {
          listId,
          title,
          tags: { create: [{ tagId: `missing_${randomUUID()}`, aggregateEligible: true }] },
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe("P2003");
    const meta = (caught as { meta?: Record<string, unknown> }).meta;
    expect(meta?.modelName).toBe("Gift");
    expect(meta).not.toHaveProperty("field_name");
    expect(meta).not.toHaveProperty("target");
    expect(constraintIndex(caught)).toBe("GiftTag_tagId_fkey");
    expect(await countGifts()).toBe(giftsBefore);

    const leftovers = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "Gift" WHERE "title" = $1`,
      [title],
    );
    expect(leftovers.rows[0]?.count).toBe(0);
    record(
      "R1 real meta: P2003 modelName=Gift, cause.constraint.index=GiftTag_tagId_fkey, no gift left",
    );
  });

  /**
   * R1/F4: a catalog row deleted between the existence check and the nested
   * create is the reported race. A BEFORE INSERT trigger deletes the tag row
   * deterministically; the action must answer VALIDATION/tags, not throw.
   */
  it("maps the real nested-create tag race to VALIDATION without a partial gift", async () => {
    const { userId } = await createOwnerFixture();
    const tagId = `tag_${randomUUID()}`;
    const slug = `f4_${randomUUID()}`;
    const title = `F4 tag race ${randomUUID()}`;
    const fn = `f4_race_${randomUUID().replaceAll("-", "")}`;
    const trigger = `f4_race_${randomUUID().replaceAll("-", "")}`;
    await client.query(
      `INSERT INTO "Tag" ("id", "slug", "labels", "updatedAt")
       VALUES ($1, $2, '{"ru":"гонка F4"}'::jsonb, NOW())`,
      [tagId, slug],
    );
    await client.query(
      `CREATE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         DELETE FROM "Tag" WHERE "id" = TG_ARGV[0];
         RETURN NEW;
       END;
       $$`,
    );
    await client.query(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "Gift"
       FOR EACH ROW WHEN (NEW."title" = '${title}')
       EXECUTE FUNCTION "${fn}"('${tagId}')`,
    );
    getSession.mockResolvedValue({ user: { id: userId }, session: { token: "t" } });

    try {
      const giftsBefore = await countGifts();
      const result = await createGift(new Headers(), {
        title,
        tags: [{ catalogId: tagId }],
      });

      expect(result).toMatchObject({ ok: false, code: "VALIDATION", field: "tags" });
      expect(result).not.toHaveProperty("data");
      expect(await countGifts()).toBe(giftsBefore);
      const leftovers = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM "Gift" WHERE "title" = $1`,
        [title],
      );
      expect(leftovers.rows[0]?.count).toBe(0);
      const orphans = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count
           FROM "GiftTag" gt
           LEFT JOIN "Tag" t ON t."id" = gt."tagId"
          WHERE gt."tagId" IS NOT NULL AND t."id" IS NULL`,
      );
      expect(orphans.rows[0]?.count).toBe(0);
      record("R1 createGift: real tag race -> VALIDATION/tags, no Gift and no orphan GiftTag");
    } finally {
      await dropGiftTrigger(trigger, fn);
      await client.query(`DELETE FROM "Gift" WHERE "title" = $1`, [title]);
      await client.query(`DELETE FROM "Tag" WHERE "id" = $1`, [tagId]);
    }
  });

  /**
   * R1/F4: the gift's own list FK must stay an infrastructure failure. The
   * same trigger shape deletes the list, so the nested write hits
   * `Gift_listId_fkey`; the action must rethrow it, never return a tags envelope.
   */
  it("rethrows the real Gift_listId_fkey from createGift", async () => {
    const { userId, listId } = await createOwnerFixture();
    const dream = await client.query<{ id: string }>(
      `SELECT "id" FROM "Tag" WHERE "slug" = 'dream'`,
    );
    const dreamId = dream.rows[0]?.id ?? "";
    const title = `F4 list race ${randomUUID()}`;
    const fn = `f4_list_${randomUUID().replaceAll("-", "")}`;
    const trigger = `f4_list_${randomUUID().replaceAll("-", "")}`;
    await client.query(
      `CREATE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         DELETE FROM "List" WHERE "id" = TG_ARGV[0];
         RETURN NEW;
       END;
       $$`,
    );
    await client.query(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "Gift"
       FOR EACH ROW WHEN (NEW."title" = '${title}')
       EXECUTE FUNCTION "${fn}"('${listId}')`,
    );
    getSession.mockResolvedValue({ user: { id: userId }, session: { token: "t" } });

    try {
      const failure = await createGift(new Headers(), {
        title,
        tags: [{ catalogId: dreamId }],
      }).then(
        function unexpectedSuccess(value) {
          throw new Error(`expected a rethrown error, got ${JSON.stringify(value)}`);
        },
        function captureRejection(error: unknown) {
          return error;
        },
      );

      expect(failure).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((failure as Prisma.PrismaClientKnownRequestError).code).toBe("P2003");
      expect(constraintIndex(failure)).toBe("Gift_listId_fkey");
      record("R1 createGift: real Gift_listId_fkey rethrown (not a tags VALIDATION)");
    } finally {
      await dropGiftTrigger(trigger, fn);
      await client.query(`DELETE FROM "Gift" WHERE "title" = $1`, [title]);
    }
  });
});
