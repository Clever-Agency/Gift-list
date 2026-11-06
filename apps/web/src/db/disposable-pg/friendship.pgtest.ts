/**
 * Story 4.1.1 R1: pair serialization for concurrent friendship invites.
 *
 * This file is NOT part of `npm test`: `vitest.config.ts` collects only
 * `src/**\/*.test.{ts,tsx}`, while this file is matched by
 * `vitest.pg-friendship.config.ts` and `verify:friendship-concurrency`.
 * Running it without a safe target fails at `resolveDisposableTarget()` before
 * any connection; it never falls back to `DATABASE_URL`/`DIRECT_URL` or
 * `apps/web/.env`.
 *
 * It proves two things on a real PostgreSQL, not on a mock:
 *
 * 1. the old check-then-insert protocol can leave TWO mutual pending invites
 *    when A→B and B→A read before either commits (the race in the 4.1.1
 *    report);
 * 2. `sendFriendInvite` now serializes both directions on one transaction-
 *    scoped advisory lock, so the pair ends as one `Friendship` edge with no
 *    pending rows left.
 *
 * Required process-local environment (PowerShell example, no `.env` edit):
 *
 *   $env:DISPOSABLE_DATABASE_URL = "postgresql://postgres:secret@127.0.0.1:58364/gift_f5_r19b896369"
 *   $env:DISPOSABLE_DIRECT_URL   = $env:DISPOSABLE_DATABASE_URL
 *   $env:DISPOSABLE_PG_CONFIRM   = "gift_f5_r19b896369"
 *   npm run verify:friendship-concurrency -w @gift-list/web
 */

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sendFriendInvite } from "../../domain/friendship";
import { friendshipStore } from "../../lib/friendship-store";
import { PrismaClient } from "../generated/client";
import {
  describeDisposableTarget,
  DisposablePgRefusal,
  resolveDisposableTarget,
  type DisposableTarget,
} from "./guard";

vi.mock("server-only", () => ({}));

const WEB_DIR = fileURLToPath(new URL("../../../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const PRISMA_CLI = join(REPO_ROOT, "node_modules", "prisma", "build", "index.js");
const EVIDENCE_DIR = join(
  REPO_ROOT,
  "_bmad-output",
  "implementation-artifacts",
  "opencode-microtasks",
);
const FRIENDSHIP_MIGRATION = "20261106200000_friendship_protocol";
const ROUNDS = 10;

let target!: DisposableTarget;
let client!: Client;
let pool!: Pool;
let prisma!: PrismaClient;
let tempDir = "";
let serverVersion = "";
let failed = false;
const evidence: string[] = [];

function record(line: string): void {
  evidence.push(`- ${line}`);
}

function resolveTargetOrReport(): DisposableTarget {
  try {
    return resolveDisposableTarget();
  } catch (error) {
    if (error instanceof DisposablePgRefusal) {
      console.error(`\n${error.message}\n`);
      console.error(
        "Set DISPOSABLE_DATABASE_URL, DISPOSABLE_DIRECT_URL and DISPOSABLE_PG_CONFIRM " +
          "for a new, empty, loopback database. See the header of friendship.pgtest.ts.",
      );
    }
    throw error;
  }
}

function runPrisma(args: readonly string[]): string {
  const result = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: WEB_DIR,
    env: {
      ...process.env,
      // Process-local overrides only; dotenv points at an empty file so a
      // repository .env cannot supply or override the target.
      DATABASE_URL: target.databaseUrl,
      DIRECT_URL: target.directUrl,
      DOTENV_CONFIG_PATH: join(tempDir, "empty.env"),
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    },
    encoding: "utf8",
    timeout: 240_000,
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} exited with ${String(result.status)}\n${output}`);
  }
  record(`prisma ${args.join(" ")}: exit 0`);
  return output;
}

function expectLoopbackClient(label: string): void {
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

type Fixture = { readonly alpha: string; readonly beta: string; readonly low: string; readonly high: string };

async function createPair(prefix: string): Promise<Fixture> {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const nickAlpha = `r1a${suffix}`;
  const nickBeta = `r1b${suffix}`;
  const alpha = await prisma.user.create({
    data: {
      name: `R1 ${prefix}`,
      email: `${prefix}-${suffix}-a@r1.invalid`,
      nick: nickAlpha,
      nickNormalized: nickAlpha,
    },
  });
  const beta = await prisma.user.create({
    data: {
      name: `R1 ${prefix}`,
      email: `${prefix}-${suffix}-b@r1.invalid`,
      nick: nickBeta,
      nickNormalized: nickBeta,
    },
  });

  return {
    alpha: alpha.id,
    beta: beta.id,
    low: alpha.id < beta.id ? alpha.id : beta.id,
    high: alpha.id < beta.id ? beta.id : alpha.id,
  };
}

async function deletePair(fixture: Fixture): Promise<void> {
  await prisma.user.deleteMany({ where: { id: { in: [fixture.alpha, fixture.beta] } } });
}

async function countPair(fixture: Fixture): Promise<{ invites: number; friendships: number }> {
  const [invites, friendships] = await Promise.all([
    prisma.friendshipInvite.count({
      where: {
        OR: [
          { fromUserId: fixture.alpha, toUserId: fixture.beta },
          { fromUserId: fixture.beta, toUserId: fixture.alpha },
        ],
      },
    }),
    prisma.friendship.count({
      where: { userLowId: fixture.low, userHighId: fixture.high },
    }),
  ]);
  return { invites, friendships };
}

function createBarrier(parties: number): () => Promise<void> {
  let arrived = 0;
  let release: () => void = () => undefined;
  const gate = new Promise<void>(function holdGate(resolve) {
    release = resolve;
  });

  return async function waitAtBarrier(): Promise<void> {
    arrived += 1;
    if (arrived === parties) release();
    await gate;
  };
}

/**
 * The protocol exactly as 4.1.1 shipped it: read the four facts, then insert
 * the directed invite. The barrier makes both transactions finish their reads
 * before either writes, which is the interleaving the UNIQUE(from,to) index
 * cannot stop.
 */
async function legacyCheckThenInsert(
  connection: Client,
  fixture: Fixture,
  fromUserId: string,
  toUserId: string,
  barrier: () => Promise<void>,
): Promise<void> {
  await connection.query("BEGIN");
  // READ COMMITTED: each SELECT below sees only rows committed before it.
  await connection.query(
    `SELECT 1 FROM "Block"
      WHERE ("blockerId" = $1 AND "blockedId" = $2)
         OR ("blockerId" = $2 AND "blockedId" = $1)
      LIMIT 1`,
    [fromUserId, toUserId],
  );
  await connection.query(
    `SELECT 1 FROM "Friendship" WHERE "userLowId" = $1 AND "userHighId" = $2 LIMIT 1`,
    [fixture.low, fixture.high],
  );
  await connection.query(
    `SELECT 1 FROM "FriendshipInvite" WHERE "fromUserId" = $1 AND "toUserId" = $2 LIMIT 1`,
    [fromUserId, toUserId],
  );
  await connection.query(
    `SELECT 1 FROM "FriendshipInvite" WHERE "fromUserId" = $1 AND "toUserId" = $2 LIMIT 1`,
    [toUserId, fromUserId],
  );

  await barrier();

  await connection.query(
    `INSERT INTO "FriendshipInvite" ("id", "fromUserId", "toUserId") VALUES ($1, $2, $3)`,
    [randomUUID(), fromUserId, toUserId],
  );
  await connection.query("COMMIT");
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

function delay(milliseconds: number): Promise<void> {
  return new Promise(function resolveAfterDelay(resolve) {
    setTimeout(resolve, milliseconds);
  });
}

describe.sequential("friendship pair serialization (Story 4.1.1 R1)", () => {
  beforeAll(async () => {
    target = resolveTargetOrReport();
    process.env.DATABASE_URL = target.databaseUrl;
    process.env.DIRECT_URL = target.directUrl;
    tempDir = mkdtempSync(join(tmpdir(), "gift-list-r1-"));
    writeFileSync(join(tempDir, "empty.env"), "");
    record(`target: ${describeDisposableTarget(target)}`);

    client = new Client({ connectionString: target.directUrl });
    await client.connect();
    expectLoopbackClient("preflight");

    const identity = await client.query<{ database: string; version: string }>(
      `SELECT current_database() AS database, current_setting('server_version') AS version`,
    );
    expect(identity.rows[0]?.database).toBe(target.database);
    serverVersion = identity.rows[0]?.version ?? "";
    record(`server: PostgreSQL ${serverVersion}`);

    const isolation = await client.query<{ default_transaction_isolation: string }>(
      `SHOW default_transaction_isolation`,
    );
    expect(isolation.rows[0]?.default_transaction_isolation).toBe("read committed");
    record("server default_transaction_isolation: read committed");

    runPrisma(["migrate", "deploy"]);

    const migration = await client.query<{ finished_at: Date | null; rolled_back_at: Date | null }>(
      `SELECT finished_at, rolled_back_at FROM "_prisma_migrations"
        WHERE migration_name = $1`,
      [FRIENDSHIP_MIGRATION],
    );
    expect(migration.rows[0]?.finished_at, "friendship migration must be applied").not.toBeNull();
    expect(migration.rows[0]?.rolled_back_at, "friendship migration must not be rolled back").toBeNull();
    record(`migration ${FRIENDSHIP_MIGRATION}: applied and finished`);

    pool = new Pool({ connectionString: target.databaseUrl, max: 10 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  }, 300_000);

  afterEach(function markFailure(context) {
    if (context.task.result?.state === "fail") failed = true;
  });

  afterAll(async () => {
    try {
      await prisma?.$disconnect();
    } catch {
      // The adapter may already have closed its pool.
    }
    try {
      await pool?.end();
    } catch {
      // Ignore a double close.
    }
    try {
      // `@/db/client` caches its own pool on `globalThis` outside production;
      // close it so the disposable database has no live sessions after the run.
      const cachedPool = (globalThis as { pgPool?: Pool }).pgPool;
      await cachedPool?.end();
    } catch {
      // Ignore a pool the adapter already closed.
    }
    try {
      await client?.end();
    } catch {
      // Ignore a double close.
    }

    if (failed) {
      console.error("4.1.1 R1 evidence was not written because at least one test failed.");
      return;
    }
    if (evidence.length === 0) return;
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(":", "").replace(/\..+$/, "");
    const path = join(EVIDENCE_DIR, `4.1.1-R1-pg-evidence-${stamp}.md`);
    const body = [
      "# 4.1.1 R1 — serialization evidence from a disposable PostgreSQL",
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
    console.log(`4.1.1 R1 evidence: ${path}`);
  }, 60_000);

  it("shows the legacy check-then-insert race leaves two mutual pendings", async () => {
    const fixture = await createPair("legacy");
    const first = new Client({ connectionString: target.directUrl });
    const second = new Client({ connectionString: target.directUrl });
    await Promise.all([first.connect(), second.connect()]);

    const barrier = createBarrier(2);
    try {
      await Promise.all([
        legacyCheckThenInsert(first, fixture, fixture.alpha, fixture.beta, barrier),
        legacyCheckThenInsert(second, fixture, fixture.beta, fixture.alpha, barrier),
      ]);
    } finally {
      await Promise.all([first.end(), second.end()]);
    }

    const counts = await countPair(fixture);
    expect(counts.invites, "legacy protocol left two mutual pendings").toBe(2);
    expect(counts.friendships).toBe(0);
    record("legacy protocol, forced interleaving: invites=2, friendships=0 (race reproduced)");

    await deletePair(fixture);
  }, 60_000);

  it("makes a send wait for the pair lock held by another transaction", async () => {
    const fixture = await createPair("lock");
    const holder = new Client({ connectionString: target.directUrl });
    await holder.connect();

    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
        `${fixture.low}:${fixture.high}`,
      ]);

      let settled = false;
      const send = sendFriendInvite(
        { fromUserId: fixture.alpha, toUserId: fixture.beta },
        friendshipStore,
      ).then(function markSettled(result) {
        settled = true;
        return result;
      });

      await delay(250);
      expect(settled, "send must block on the canonical pair lock").toBe(false);
      record("sendFriendInvite blocked while another transaction held the canonical pair lock");

      await holder.query("COMMIT");
      await expect(send).resolves.toEqual({ ok: true, outcome: "INVITED" });
    } finally {
      await holder.end();
    }

    const counts = await countPair(fixture);
    expect(counts).toEqual({ invites: 1, friendships: 0 });
    record("after the lock holder committed: one pending invite, no friendship");
    await deletePair(fixture);
  }, 60_000);

  it("serializes real concurrent opposite sends into one friendship edge", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const fixture = await createPair(`opposite${round}`);

      const results = await Promise.all([
        sendFriendInvite({ fromUserId: fixture.alpha, toUserId: fixture.beta }, friendshipStore),
        sendFriendInvite({ fromUserId: fixture.beta, toUserId: fixture.alpha }, friendshipStore),
      ]);

      expect(results.every((result) => result.ok), `round ${round}: both sends succeed`).toBe(true);
      const outcomes = results
        .map((result) => (result.ok ? result.outcome : result.code))
        .sort();
      expect(outcomes, `round ${round}: one invite, one auto-accept`).toEqual([
        "FRIENDS_CREATED",
        "INVITED",
      ]);

      const counts = await countPair(fixture);
      expect(counts, `round ${round}: exactly one edge, no pending invites`).toEqual({
        invites: 0,
        friendships: 1,
      });

      await deletePair(fixture);
    }

    record(`${ROUNDS}/${ROUNDS} opposite-send rounds: one Friendship edge, 0 invites`);
  }, 120_000);

  it("serializes real concurrent identical sends into one pending invite", async () => {
    const fixture = await createPair("same");

    const results = await Promise.all([
      sendFriendInvite({ fromUserId: fixture.alpha, toUserId: fixture.beta }, friendshipStore),
      sendFriendInvite({ fromUserId: fixture.alpha, toUserId: fixture.beta }, friendshipStore),
    ]);

    const outcomes = results.map((result) => (result.ok ? result.outcome : result.code)).sort();
    expect(outcomes).toEqual(["INVITED", "PENDING"]);
    expect(await countPair(fixture)).toEqual({ invites: 1, friendships: 0 });
    record("identical concurrent sends: one INVITED, one PENDING, one row");

    await deletePair(fixture);
  }, 60_000);

  it("keeps the committed canonical-pair constraints", async () => {
    const fixture = await createPair("constraint");

    await expectPostgresError(
      `INSERT INTO "Friendship" ("id", "userLowId", "userHighId") VALUES ($1, $2, $3)`,
      [randomUUID(), fixture.high, fixture.low],
      "23514",
    );
    record("Friendship_order_check rejects reversed userLowId/userHighId (23514)");

    await prisma.friendship.create({
      data: { userLowId: fixture.low, userHighId: fixture.high },
    });
    await expectPostgresError(
      `INSERT INTO "Friendship" ("id", "userLowId", "userHighId") VALUES ($1, $2, $3)`,
      [randomUUID(), fixture.low, fixture.high],
      "23505",
    );
    record("Friendship_userLowId_userHighId_key rejects a second edge (23505)");

    await expectPostgresError(
      `INSERT INTO "FriendshipInvite" ("id", "fromUserId", "toUserId") VALUES ($1, $2, $3)`,
      [randomUUID(), fixture.alpha, fixture.alpha],
      "23514",
    );
    record("FriendshipInvite_pair_check rejects a self invite (23514)");

    await deletePair(fixture);
  }, 60_000);
});
