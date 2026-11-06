/**
 * Safety gate for the F5 / Q-04 disposable PostgreSQL verification.
 *
 * The verification may run `prisma migrate deploy`, `prisma db seed` and writes
 * against PostgreSQL, so the target must be proven disposable before the first
 * connection. The gate:
 *
 * - reads only the `DISPOSABLE_*` variables, never `DATABASE_URL`/`DIRECT_URL`
 *   or `apps/web/.env`, so a missing variable cannot fall through to a
 *   development, shared or production database;
 * - accepts only a literal loopback host (`127.0.0.1` or `[::1]`), a dynamic
 *   port (`49152`-`65535`, therefore not the default `5432`) and a database
 *   name reserved for this check (`gift_f5_[a-z0-9_]{8,40}`);
 * - requires the same target and credentials in both URLs, because Prisma
 *   prefers `DIRECT_URL` while the application pool uses `DATABASE_URL`;
 * - requires `DISPOSABLE_PG_CONFIRM` to repeat the database name, so a typo or
 *   an inherited environment cannot start a destructive run by accident.
 *
 * `vitest.pg.config.ts` runs `verify.pgtest.ts`, which calls
 * `resolveDisposableTarget()` before connecting. The gate throws
 * `DisposablePgRefusal`; it never degrades to a warning or a skip.
 */

/** Prefix reserved for F5 databases; also prevents pointing at an app database. */
export const DISPOSABLE_DB_PREFIX = "gift_f5_";

const DATABASE_NAME_PATTERN = /^gift_f5_[a-z0-9_]{8,40}$/;
const ALLOWED_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
/** Literal loopback only: `localhost` may resolve elsewhere and is refused. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]"]);
/** IANA dynamic range; keeps a run off the default/shared PostgreSQL port. */
const MIN_DISPOSABLE_PORT = 49152;
const MAX_DISPOSABLE_PORT = 65535;

export type DisposablePgRefusalCode =
  | "missing-database-url"
  | "missing-direct-url"
  | "not-a-postgres-url"
  | "query-parameters-not-allowed"
  | "user-required"
  | "password-required"
  | "ambiguous-host"
  | "not-loopback"
  | "dynamic-port-required"
  | "unsafe-database-name"
  | "target-mismatch"
  | "confirmation-required";

/** Thrown before any connection or command when the target is not disposable. */
export class DisposablePgRefusal extends Error {
  readonly code: DisposablePgRefusalCode;

  constructor(code: DisposablePgRefusalCode, detail: string) {
    super(`Disposable PostgreSQL refused [${code}]: ${detail}`);
    this.name = "DisposablePgRefusal";
    this.code = code;
  }
}

export type DisposableTarget = {
  /** Connection string for the application roles (`DATABASE_URL`). */
  readonly databaseUrl: string;
  /** Direct connection string (`DIRECT_URL`); same target as `databaseUrl`. */
  readonly directUrl: string;
  readonly database: string;
  readonly host: string;
  readonly port: number;
  readonly user: string;
  /** Never log or persist this value. */
  readonly password: string;
};

type ParsedUrl = {
  readonly raw: string;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
};

function refuse(code: DisposablePgRefusalCode, detail: string): never {
  throw new DisposablePgRefusal(code, detail);
}

type Environment = Readonly<Record<string, string | undefined>>;

function readRequired(env: Environment, name: string, code: DisposablePgRefusalCode): string {
  const value = env[name]?.trim();
  if (!value) {
    refuse(
      code,
      `${name} is not set; export it for this process only (never add it to apps/web/.env).`,
    );
  }
  return value;
}

/** Password-free description for logs, evidence files and failure messages. */
export function describeDisposableTarget(target: DisposableTarget): string {
  return `${target.host}:${target.port}/${target.database} as ${target.user}`;
}

/** Removes fragments and password from a connection string. */
export function sanitizeDisposableUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "<unparseable connection string>";
  }
}

function parseOne(raw: string, name: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    refuse("not-a-postgres-url", `${name} is not a parseable URL.`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    refuse(
      "not-a-postgres-url",
      `${name} must use postgres:// or postgresql://, got ${url.protocol || "no scheme"}.`,
    );
  }

  if (url.search !== "" || url.hash !== "") {
    refuse(
      "query-parameters-not-allowed",
      `${name} must not carry query parameters or a fragment: they can redirect the connection.`,
    );
  }

  const user = decodeURIComponent(url.username);
  if (user === "") refuse("user-required", `${name} has no user.`);

  const password = decodeURIComponent(url.password);
  if (password === "") {
    refuse("password-required", `${name} has no password; an empty credential is not accepted.`);
  }

  if (url.hostname === "localhost") {
    refuse(
      "ambiguous-host",
      `${name} uses localhost; write 127.0.0.1 or [::1] so the loopback target is unambiguous.`,
    );
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    refuse("not-loopback", `${name} points at ${url.hostname || "<no host>"}, not at loopback.`);
  }

  if (!/^\d+$/.test(url.port)) {
    refuse("dynamic-port-required", `${name} must name an explicit port in ${MIN_DISPOSABLE_PORT}-${MAX_DISPOSABLE_PORT}.`);
  }
  const port = Number(url.port);
  if (port < MIN_DISPOSABLE_PORT || port > MAX_DISPOSABLE_PORT) {
    refuse(
      "dynamic-port-required",
      `${name} uses port ${port}; a disposable instance must publish a unique port in ${MIN_DISPOSABLE_PORT}-${MAX_DISPOSABLE_PORT}.`,
    );
  }

  const encodedDatabase = url.pathname.replace(/^\//, "");
  let database: string;
  try {
    database = decodeURIComponent(encodedDatabase);
  } catch {
    refuse("unsafe-database-name", `${name} has an undecodable database name.`);
  }
  if (database.includes("/")) {
    refuse("unsafe-database-name", `${name} names a path instead of a single database.`);
  }
  if (!DATABASE_NAME_PATTERN.test(database)) {
    refuse(
      "unsafe-database-name",
      `${name} database "${database}" must match ${DISPOSABLE_DB_PREFIX}[a-z0-9_]{8,40}; ` +
        "create a new database with that name for this run.",
    );
  }

  return { raw, host: url.hostname, port, database, user, password };
}

/**
 * Validates the process-local disposable target.
 *
 * Reads `DISPOSABLE_DATABASE_URL`, `DISPOSABLE_DIRECT_URL` and
 * `DISPOSABLE_PG_CONFIRM` only. Deliberately ignores `DATABASE_URL` and
 * `DIRECT_URL`: the caller exports them from this result for child processes
 * (Prisma CLI and seed) for the duration of the run.
 */
export function resolveDisposableTarget(env: Environment = process.env): DisposableTarget {
  const databaseUrl = readRequired(env, "DISPOSABLE_DATABASE_URL", "missing-database-url");
  const directUrl = readRequired(env, "DISPOSABLE_DIRECT_URL", "missing-direct-url");

  const database = parseOne(databaseUrl, "DISPOSABLE_DATABASE_URL");
  const direct = parseOne(directUrl, "DISPOSABLE_DIRECT_URL");

  if (
    database.host !== direct.host ||
    database.port !== direct.port ||
    database.database !== direct.database ||
    database.user !== direct.user ||
    database.password !== direct.password
  ) {
    refuse(
      "target-mismatch",
      "DISPOSABLE_DATABASE_URL and DISPOSABLE_DIRECT_URL must name the same host, port, database, user and password.",
    );
  }

  const confirmation = env.DISPOSABLE_PG_CONFIRM?.trim() ?? "";
  if (confirmation !== database.database) {
    refuse(
      "confirmation-required",
      `set DISPOSABLE_PG_CONFIRM to the exact database name "${database.database}" to confirm this disposable target.`,
    );
  }

  return {
    databaseUrl: database.raw,
    directUrl: direct.raw,
    database: database.database,
    host: database.host,
    port: database.port,
    user: database.user,
    password: database.password,
  };
}
