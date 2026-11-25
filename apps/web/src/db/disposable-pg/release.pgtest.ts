/**
 * Story 5.2 (AD-15-1), CLE-124/D-49: a holder's release and the timer's expiry
 * release of one reservation at the same time. Exactly one CAS succeeds, the
 * second answers `lost`, and exactly one NFR-6 audit line is written. The owner
 * takes no part in a reservation of their own wish anymore.
 *
 * Not part of `npm test` (`*.test.ts` only). It refuses anything except a
 * disposable loopback database named by `DISPOSABLE_*` — never `DATABASE_URL`
 * from `.env`, and never staging or production:
 *
 *   DISPOSABLE_DATABASE_URL=postgresql://postgres:secret@127.0.0.1:54321/gift_f5_release01 \
 *   DISPOSABLE_DIRECT_URL=$DISPOSABLE_DATABASE_URL \
 *   DISPOSABLE_PG_CONFIRM=gift_f5_release01 \
 *   npx vitest run --config vitest.pg-reserve.config.ts
 *
 * `vitest.pg-reserve.config.ts` lists only `reserve.pgtest.ts`, so the run above
 * needs this file in its `include` (or a config of its own) before it picks the
 * test up.
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

describe.sequential("parallel release CAS (Story 5.2 / CLE-124)", () => {
  beforeAll(async () => {
    target = resolveTargetOrReport();
    tempDir = mkdtempSync(join(tmpdir(), "gift-list-release-"));
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

  it("lets exactly one of a simultaneous holder release and timer release win, with one audit line", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const owner = await prisma.user.create({
      data: {
        name: "Владелец",
        nameNormalized: `owner ${suffix}`,
        email: `owner-${suffix}@release.invalid`,
        nick: `own${suffix}`,
        nickNormalized: `own${suffix}`,
      },
    });
    const holder = await prisma.user.create({
      data: {
        name: "Держатель",
        nameNormalized: `holder ${suffix}`,
        email: `holder-${suffix}@release.invalid`,
        nick: `hol${suffix}`,
        nickNormalized: `hol${suffix}`,
      },
    });
    const list = await prisma.list.create({
      data: { ownerId: owner.id, publicToken: `tok${suffix}` },
    });
    const at = new Date("2026-11-19T10:00:00.000Z");
    // The deadline is already 168 hours old: the timer may release the row, and
    // the phase started an hour ago, so step 3 is allowed for it.
    const reservationDueAt = new Date(at.getTime() - 200 * 60 * 60 * 1000);
    const gift = await prisma.gift.create({
      data: {
        listId: list.id,
        title: "Плед",
        quantity: "SINGLE",
        status: "RESERVED",
        reservedById: holder.id,
        reservedAt: at,
        titleSnapshotOnReserve: "Плед",
        reservationDueAt,
        reservationTimeZone: "Europe/Minsk",
        reservationPhase: "AWAITING_OWNER",
        reservationPhaseAt: new Date(at.getTime() - 60 * 60 * 1000),
        holderVisibleToOwner: false,
        holderVisibleToOthers: false,
      },
    });

    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const [byHolder, byTimer] = await Promise.all([
      prisma.$transaction(function releaseAsHolder(tx) {
        return giftStatusTransaction(tx).releaseReservationByHolder(gift.id, holder.id, at);
      }),
      prisma.$transaction(function releaseAsTimer(tx) {
        return giftStatusTransaction(tx).releaseReservationByExpiry(gift.id, at);
      }),
    ]);

    expect([byHolder, byTimer].sort()).toEqual(["lost", "success"]);
    expect(info).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line).toEqual({
      event: byTimer === "success" ? "gift.reservation.released-by-expiry" : "gift.status",
      giftId: gift.id,
      actorId: byTimer === "success" ? null : holder.id,
      from: "RESERVED",
      to: "OPEN",
      ...(byTimer === "success" ? { recipientId: holder.id } : {}),
      at: at.toISOString(),
    });
    info.mockRestore();

    const stored = await prisma.gift.findUniqueOrThrow({ where: { id: gift.id } });
    expect(stored.status).toBe("OPEN");
    expect(stored.reservedById).toBeNull();
    expect(stored.reservedAt).toBeNull();
    expect(stored.reservationDueAt).toBeNull();
    expect(stored.reservationTimeZone).toBeNull();
    expect(stored.reservationPhase).toBeNull();
    expect(stored.reservationPhaseAt).toBeNull();
    expect(stored.reservationBought).toBe(false);
    expect(stored.holderVisibleToOwner).toBe(false);
    expect(stored.holderVisibleToOthers).toBe(true);
    expect(stored.titleSnapshotOnReserve).toBeNull();

    // A second attempt of either side finds nothing to release.
    const again = await Promise.all([
      prisma.$transaction(function releaseAgainAsHolder(tx) {
        return giftStatusTransaction(tx).releaseReservationByHolder(gift.id, holder.id, at);
      }),
      prisma.$transaction(function releaseAgainAsTimer(tx) {
        return giftStatusTransaction(tx).releaseReservationByExpiry(gift.id, at);
      }),
    ]);
    expect(again).toEqual(["lost", "lost"]);
  });
});
