/**
 * Preflight for `npm run verify:disposable-pg` (F5 / Q-04).
 *
 * Runs before vitest so a missing or unsafe target prints the exact reason and
 * exits non-zero, instead of a bare "no tests". This script only reads
 * `DISPOSABLE_*`; it never loads `apps/web/.env` and never falls back to
 * `DATABASE_URL`/`DIRECT_URL`.
 *
 * The target must be a new, empty database on PostgreSQL 17 or 18 created with
 * UTF-8. The major and `server_encoding` are checked after connecting
 * (`cluster-preflight.ts`); a WIN1251 cluster fails tags with emoji (22P05).
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
      "F5 refuses to run. Start a disposable PostgreSQL 17 or 18 on a unique loopback port " +
        "and create its cluster with UTF-8 (POSTGRES_INITDB_ARGS=--encoding=UTF8, or " +
        "initdb --encoding=UTF8 --locale=C natively), create a new empty database named " +
        "gift_f5_<random>, then export DISPOSABLE_DATABASE_URL, DISPOSABLE_DIRECT_URL and " +
        "DISPOSABLE_PG_CONFIRM for this process only. Never point these at a live or shared " +
        "database.",
    );
    process.exitCode = 2;
  } else {
    throw error;
  }
}
