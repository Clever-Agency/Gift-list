/**
 * Story 5.1 (AD-15-1): two parallel reserves of one OPEN SINGLE wish.
 *
 * Not part of `npm test` (`*.test.ts` only). It refuses anything except a
 * disposable loopback database named by `DISPOSABLE_*` — never `DATABASE_URL`
 * from `.env`, and never staging or production.
 *
 *   DISPOSABLE_DATABASE_URL=postgresql://postgres:secret@127.0.0.1:54321/gift_f5_reserve01 \
 *   DISPOSABLE_DIRECT_URL=$DISPOSABLE_DATABASE_URL \
 *   DISPOSABLE_PG_CONFIRM=gift_f5_reserve01 \
 *   npx vitest run --config vitest.config.ts src/db/disposable-pg/reserve.pgtest.ts
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { giftStatusTransaction } from "@/lib/gift-status-store";
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

let target!: DisposableTarget;
let admin!: Client;
let pool!: Pool;
let prisma!: PrismaClient;
let tempDir = "";

function resolveTargetOrReport(): DisposableTarget {
  try {
    return resolveDisposableTarget();
  } catch (error) {
    if (error instanceof DisposablePgRefusal) {
      console.error(`\n${error.message}\n`);
    }
    throw error;
  }
}

function runPrisma(args: readonly string[]): void {
  const result = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: WEB_DIR,
    env: {
      ...process.env,
      DATABASE_URL: target.databaseUrl,
      DIRECT_URL: target.directUrl,
      DOTENV_CONFIG_PATH: join(tempDir, "empty.env"),
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    },
    encoding: "utf8",
    timeout: 240_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `prisma ${args.join(" ")} exited with ${String(result.status)}\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
}

describe.sequential("parallel reserve CAS (Story 5.1)", () => {
  beforeAll(async () => {
    target = resolveTargetOrReport();
    tempDir = mkdtempSync(join(tmpdir(), "gift-list-reserve-"));
    writeFileSync(join(tempDir, "empty.env"), "");
    console.info(describeDisposableTarget(target));

    admin = new Client({ connectionString: target.directUrl });
    await admin.connect();
    const identity = await admin.query<{ database: string }>(
      `SELECT current_database() AS database`,
    );
    expect(identity.rows[0]?.database).toBe(target.database);

    runPrisma(["migrate", "deploy"]);

    pool = new Pool({ connectionString: target.databaseUrl, max: 4 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect().catch(function ignoreDisconnect() {
      return undefined;
    });
    await pool?.end().catch(function ignorePool() {
      return undefined;
    });
    await admin?.end().catch(function ignoreAdmin() {
      return undefined;
    });
  });

  it("lets exactly one of two concurrent reserves win", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const owner = await prisma.user.create({
      data: {
        name: "Владелец",
        nameNormalized: `owner ${suffix}`,
        email: `owner-${suffix}@reserve.invalid`,
        nick: `own${suffix}`,
        nickNormalized: `own${suffix}`,
      },
    });
    const first = await prisma.user.create({
      data: {
        name: "Первый",
        nameNormalized: `first ${suffix}`,
        email: `first-${suffix}@reserve.invalid`,
        nick: `a${suffix}`,
        nickNormalized: `a${suffix}`,
      },
    });
    const second = await prisma.user.create({
      data: {
        name: "Второй",
        nameNormalized: `second ${suffix}`,
        email: `second-${suffix}@reserve.invalid`,
        nick: `b${suffix}`,
        nickNormalized: `b${suffix}`,
      },
    });
    const list = await prisma.list.create({
      data: { ownerId: owner.id, publicToken: `tok${suffix}` },
    });
    const gift = await prisma.gift.create({
      data: { listId: list.id, title: "Плед", quantity: "SINGLE", status: "OPEN" },
    });

    const dueAt = new Date("2026-12-01T00:00:00.000Z");
    function write(holderId: string) {
      return {
        reservedById: holderId,
        reservedAt: dueAt,
        titleSnapshotOnReserve: "Плед",
        reservationDueAt: dueAt,
        reservationTimeZone: "Europe/Minsk",
        reservationPhaseAt: dueAt,
        holderVisibleToOwner: false,
        holderVisibleToOthers: true,
      };
    }

    const [left, right] = await Promise.all([
      prisma.$transaction(function reserveLeft(tx) {
        return giftStatusTransaction(tx).reserveGift(gift.id, write(first.id));
      }),
      prisma.$transaction(function reserveRight(tx) {
        return giftStatusTransaction(tx).reserveGift(gift.id, write(second.id));
      }),
    ]);

    const outcomes = [left, right].sort();
    expect(outcomes).toEqual(["lost", "success"]);

    const stored = await prisma.gift.findUniqueOrThrow({ where: { id: gift.id } });
    expect(stored.status).toBe("RESERVED");
    expect(stored.reservationPhase).toBe("ACTIVE");
    expect([first.id, second.id]).toContain(stored.reservedById);
    expect(stored.titleSnapshotOnReserve).toBe("Плед");

    const again = await prisma.$transaction(function reserveAgain(tx) {
      return giftStatusTransaction(tx).reserveGift(gift.id, write(first.id));
    });
    expect(again).toBe("lost");

    const unlimited = await prisma.gift.create({
      data: { listId: list.id, title: "Носки", quantity: "UNLIMITED", status: "OPEN" },
    });
    const refused = await prisma.$transaction(function reserveUnlimited(tx) {
      return giftStatusTransaction(tx).reserveGift(unlimited.id, write(first.id));
    });
    expect(refused).toBe("lost");
    const stillOpen = await prisma.gift.findUniqueOrThrow({ where: { id: unlimited.id } });
    expect(stillOpen.status).toBe("OPEN");
    expect(stillOpen.reservedById).toBeNull();
  });
});
