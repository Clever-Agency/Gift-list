/**
 * Preflight for `npm run verify:disposable-pg` (F5 / Q-04).
 *
 * Runs before vitest so a missing or unsafe target prints the exact reason and
 * exits non-zero, instead of a bare "no tests". This script only reads
 * `DISPOSABLE_*`; it never loads `apps/web/.env` and never falls back to
 * `DATABASE_URL`/`DIRECT_URL`.
 */

import {
  describeDisposableTarget,
  DisposablePgRefusal,
  resolveDisposableTarget,
} from "../src/db/disposable-pg/guard.ts";

try {
  const target = resolveDisposableTarget();
  console.log(`Disposable PostgreSQL target accepted: ${describeDisposableTarget(target)}`);
} catch (error) {
  if (error instanceof DisposablePgRefusal) {
    console.error(`\n${error.message}\n`);
    console.error(
      "F5 refuses to run. Start a disposable PostgreSQL on a unique loopback port " +
        "(no shared volume), create a new empty database named gift_f5_<random>, then export " +
        "DISPOSABLE_DATABASE_URL, DISPOSABLE_DIRECT_URL and DISPOSABLE_PG_CONFIRM " +
        "for this process only. Never point these at a live or shared database.",
    );
    process.exitCode = 2;
  } else {
    throw error;
  }
}
