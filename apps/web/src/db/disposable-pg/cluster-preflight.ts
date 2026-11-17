/**
 * Cluster requirements for the F5 / Q-04 disposable PostgreSQL run.
 *
 * `guard.ts` proves the target is a new loopback database before the first
 * connection, but it cannot know what server runs behind that port. Two real
 * failures are refused here, after the connection and before `migrate deploy`:
 *
 * - a run on PostgreSQL 18.6 with `server_encoding = WIN1251`: a native
 *   Windows `initdb` took the code page from the system locale, and the 30
 *   emoji in a tag failed with SQLSTATE 22P05. The cluster must be UTF8;
 * - a run on a major outside the supported matrix proves nothing.
 *
 * Supported majors are 17 and 18 (QA checkpoints: 17.11 and 18.6).
 * `DISPOSABLE_PG_MAJOR` may pin one of them for a run; empty means either.
 *
 * Nothing is installed here: the operator starts the cluster. For the official
 * image set `POSTGRES_INITDB_ARGS=--encoding=UTF8`; for a native cluster run
 * `initdb --encoding=UTF8 --locale=C` (or `C.UTF-8`) instead of relying on the
 * Windows locale or code page.
 */

export const SUPPORTED_PG_MAJORS = [17, 18] as const;

export type SupportedPgMajor = (typeof SUPPORTED_PG_MAJORS)[number];

export type DisposablePgClusterRefusalCode =
  | "unrecognized-server-version"
  | "unsupported-server-major"
  | "server-encoding-not-utf8"
  | "invalid-major-pin"
  | "major-pin-mismatch";

/** Thrown after connecting when the cluster is not the supported UTF8 17/18. */
export class DisposablePgClusterRefusal extends Error {
  readonly code: DisposablePgClusterRefusalCode;

  constructor(code: DisposablePgClusterRefusalCode, detail: string) {
    super(`Disposable PostgreSQL cluster refused [${code}]: ${detail}`);
    this.name = "DisposablePgClusterRefusal";
    this.code = code;
  }
}

export type ClusterFacts = {
  /** `server_version` exactly as the server reported it. */
  readonly serverVersion: string;
  readonly major: SupportedPgMajor;
  /** `server_encoding` exactly as the server reported it. */
  readonly serverEncoding: string;
};

export type ClusterCheckInput = {
  readonly serverVersion: string;
  readonly serverEncoding: string;
  /** Raw `DISPOSABLE_PG_MAJOR`; empty or undefined means "either major". */
  readonly pinnedMajor?: string | undefined;
};

/** `17.11`, `18.6 (Debian ...)`, `17.11 on x86_64-pc-linux-musl`. */
const SERVER_VERSION_PATTERN = /^\s*(\d+)\.(\d+)/;

function refuse(code: DisposablePgClusterRefusalCode, detail: string): never {
  throw new DisposablePgClusterRefusal(code, detail);
}

function isSupportedMajor(major: number): major is SupportedPgMajor {
  return (SUPPORTED_PG_MAJORS as readonly number[]).includes(major);
}

/** PostgreSQL reports `UTF8`; `UTF-8` and any case are accepted as the same. */
function isUtf8(encoding: string): boolean {
  return encoding.trim().toUpperCase().replace(/[-_ ]/g, "") === "UTF8";
}

function readPinnedMajor(pinnedMajor: string | undefined): SupportedPgMajor | null {
  const value = pinnedMajor?.trim() ?? "";
  if (value === "") return null;

  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !isSupportedMajor(parsed)) {
    refuse(
      "invalid-major-pin",
      `DISPOSABLE_PG_MAJOR="${value}" is not a supported major; set it to 17 or 18, ` +
        "or leave it empty to accept either.",
    );
  }
  return parsed;
}

/**
 * Validates the connected server against the F5 matrix and returns the facts
 * for the evidence file. Throws `DisposablePgClusterRefusal` with a message
 * that names the fix; it never retries, installs or silently continues.
 */
export function checkDisposableCluster(input: ClusterCheckInput): ClusterFacts {
  const serverVersion = input.serverVersion.trim();
  const serverEncoding = input.serverEncoding.trim();

  const match = SERVER_VERSION_PATTERN.exec(serverVersion);
  const majorText = match?.[1];
  if (majorText === undefined) {
    refuse(
      "unrecognized-server-version",
      `cannot read a major from server_version "${serverVersion}"; ` +
        "expected forms like 17.11 or 18.6 (Debian).",
    );
  }

  const major = Number(majorText);
  if (!isSupportedMajor(major)) {
    refuse(
      "unsupported-server-major",
      `server is PostgreSQL ${serverVersion}, but only ${SUPPORTED_PG_MAJORS.join(" and ")} ` +
        "are supported. Point DISPOSABLE_* at a PostgreSQL 17 or 18 cluster; " +
        "the harness installs nothing.",
    );
  }

  if (!isUtf8(serverEncoding)) {
    refuse(
      "server-encoding-not-utf8",
      `server_encoding is "${serverEncoding}", but the F5 harness requires UTF8: ` +
        "a WIN1251 cluster rejects tags with emoji (22P05). Create the cluster with " +
        "`initdb --encoding=UTF8 --locale=C` (or C.UTF-8), or set " +
        "POSTGRES_INITDB_ARGS=--encoding=UTF8 for the official image; " +
        "never rely on the Windows locale or code page.",
    );
  }

  const pinned = readPinnedMajor(input.pinnedMajor);
  if (pinned !== null && pinned !== major) {
    refuse(
      "major-pin-mismatch",
      `DISPOSABLE_PG_MAJOR is pinned to ${pinned}, but the server is PostgreSQL ` +
        `${serverVersion}. Point DISPOSABLE_* at a PostgreSQL ${pinned} cluster ` +
        "or clear the pin.",
    );
  }

  return { serverVersion, major, serverEncoding };
}
