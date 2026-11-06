import { describe, expect, it } from "vitest";
import {
  describeDisposableTarget,
  DisposablePgRefusal,
  resolveDisposableTarget,
  sanitizeDisposableUrl,
} from "./guard";

const DB_NAME = "gift_f5_abc12345xyz";
const DATABASE_URL = `postgresql://f5_user:f5-secret@127.0.0.1:55432/${DB_NAME}`;
const DIRECT_URL = DATABASE_URL;

function makeEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    DISPOSABLE_DATABASE_URL: DATABASE_URL,
    DISPOSABLE_DIRECT_URL: DIRECT_URL,
    DISPOSABLE_PG_CONFIRM: DB_NAME,
    ...overrides,
  };
}

function refusalFrom(env: Record<string, string | undefined>): DisposablePgRefusal {
  try {
    resolveDisposableTarget(env);
  } catch (error) {
    expect(error).toBeInstanceOf(DisposablePgRefusal);
    return error as DisposablePgRefusal;
  }
  throw new Error("expected the guard to refuse this target");
}

describe("resolveDisposableTarget", () => {
  it("accepts a loopback dynamic-port database with an explicit confirmation", () => {
    const target = resolveDisposableTarget(makeEnv());

    expect(target).toEqual({
      databaseUrl: DATABASE_URL,
      directUrl: DIRECT_URL,
      database: DB_NAME,
      host: "127.0.0.1",
      port: 55432,
      user: "f5_user",
      password: "f5-secret",
    });
  });

  it("accepts an IPv6 loopback literal", () => {
    const url = `postgresql://f5_user:f5-secret@[::1]:55432/${DB_NAME}`;
    const target = resolveDisposableTarget(
      makeEnv({ DISPOSABLE_DATABASE_URL: url, DISPOSABLE_DIRECT_URL: url }),
    );

    expect(target.host).toBe("[::1]");
  });

  it("never reads DATABASE_URL or DIRECT_URL as a fallback", () => {
    const env = makeEnv();

    // A live-looking ambient value must be ignored: only DISPOSABLE_* count.
    const target = resolveDisposableTarget({
      ...env,
      DATABASE_URL: "postgresql://prod:prod@db.example.com:5432/prod",
      DIRECT_URL: "postgresql://prod:prod@db.example.com:5432/prod",
    });

    expect(target.database).toBe(DB_NAME);
    expect(target.host).toBe("127.0.0.1");
  });

  it("refuses when DATABASE_URL is missing even if DIRECT_URL is set", () => {
    const refusal = refusalFrom(makeEnv({ DISPOSABLE_DATABASE_URL: undefined }));

    expect(refusal.code).toBe("missing-database-url");
    expect(refusal.message).toContain("DISPOSABLE_DATABASE_URL");
  });

  it("refuses when DIRECT_URL is missing even if DATABASE_URL is set", () => {
    const refusal = refusalFrom(makeEnv({ DISPOSABLE_DIRECT_URL: undefined }));

    expect(refusal.code).toBe("missing-direct-url");
  });

  it.each([
    ["a remote host", "postgresql://f5_user:f5-secret@db.example.com:55432/gift_f5_abc12345xyz", "not-loopback"],
    ["0.0.0.0", "postgresql://f5_user:f5-secret@0.0.0.0:55432/gift_f5_abc12345xyz", "not-loopback"],
    ["localhost", "postgresql://f5_user:f5-secret@localhost:55432/gift_f5_abc12345xyz", "ambiguous-host"],
  ])("refuses %s", (_name, url, code) => {
    const refusal = refusalFrom(
      makeEnv({ DISPOSABLE_DATABASE_URL: url, DISPOSABLE_DIRECT_URL: url }),
    );

    expect(refusal.code).toBe(code);
  });

  it.each([
    ["the default port", "postgresql://f5_user:f5-secret@127.0.0.1:5432/gift_f5_abc12345xyz"],
    ["a low port", "postgresql://f5_user:f5-secret@127.0.0.1:1234/gift_f5_abc12345xyz"],
    ["no port", "postgresql://f5_user:f5-secret@127.0.0.1/gift_f5_abc12345xyz"],
  ])("refuses %s", (_name, url) => {
    const refusal = refusalFrom(
      makeEnv({ DISPOSABLE_DATABASE_URL: url, DISPOSABLE_DIRECT_URL: url }),
    );

    expect(refusal.code).toBe("dynamic-port-required");
  });

  it.each([
    ["the postgres database", "postgresql://f5_user:f5-secret@127.0.0.1:55432/postgres"],
    ["a short suffix", "postgresql://f5_user:f5-secret@127.0.0.1:55432/gift_f5_abc"],
    ["an application-looking name", "postgresql://f5_user:f5-secret@127.0.0.1:55432/gift_list"],
    ["a path", "postgresql://f5_user:f5-secret@127.0.0.1:55432/gift_f5_abc12345xyz/extra"],
  ])("refuses %s as a database name", (_name, url) => {
    const refusal = refusalFrom(
      makeEnv({ DISPOSABLE_DATABASE_URL: url, DISPOSABLE_DIRECT_URL: url }),
    );

    expect(refusal.code).toBe("unsafe-database-name");
  });

  it("refuses non-PostgreSQL schemes", () => {
    const refusal = refusalFrom(
      makeEnv({
        DISPOSABLE_DATABASE_URL: "mysql://f5_user:f5-secret@127.0.0.1:55432/gift_f5_abc12345xyz",
        DISPOSABLE_DIRECT_URL: "mysql://f5_user:f5-secret@127.0.0.1:55432/gift_f5_abc12345xyz",
      }),
    );

    expect(refusal.code).toBe("not-a-postgres-url");
  });

  it("refuses query parameters that could redirect the connection", () => {
    const url = `${DATABASE_URL}?host=db.example.com`;
    const refusal = refusalFrom(
      makeEnv({ DISPOSABLE_DATABASE_URL: url, DISPOSABLE_DIRECT_URL: url }),
    );

    expect(refusal.code).toBe("query-parameters-not-allowed");
  });

  it("refuses an empty password", () => {
    const url = `postgresql://f5_user@127.0.0.1:55432/${DB_NAME}`;
    const refusal = refusalFrom(
      makeEnv({ DISPOSABLE_DATABASE_URL: url, DISPOSABLE_DIRECT_URL: url }),
    );

    expect(refusal.code).toBe("password-required");
  });

  it("refuses URLs that name different databases", () => {
    const refusal = refusalFrom(
      makeEnv({
        DISPOSABLE_DIRECT_URL: "postgresql://f5_user:f5-secret@127.0.0.1:55432/gift_f5_other12345",
      }),
    );

    expect(refusal.code).toBe("target-mismatch");
  });

  it("refuses URLs that name different users", () => {
    const refusal = refusalFrom(
      makeEnv({
        DISPOSABLE_DIRECT_URL: `postgresql://other:f5-secret@127.0.0.1:55432/${DB_NAME}`,
      }),
    );

    expect(refusal.code).toBe("target-mismatch");
  });

  it("refuses a missing or mismatched confirmation", () => {
    expect(refusalFrom(makeEnv({ DISPOSABLE_PG_CONFIRM: undefined })).code).toBe(
      "confirmation-required",
    );
    expect(refusalFrom(makeEnv({ DISPOSABLE_PG_CONFIRM: "gift_f5_other12345" })).code).toBe(
      "confirmation-required",
    );
  });
});

describe("disposable target formatting", () => {
  it("keeps the password out of descriptions and sanitized URLs", () => {
    const target = resolveDisposableTarget(makeEnv());

    expect(describeDisposableTarget(target)).toBe(`127.0.0.1:55432/${DB_NAME} as f5_user`);
    expect(describeDisposableTarget(target)).not.toContain("f5-secret");

    const sanitized = sanitizeDisposableUrl(DATABASE_URL);
    expect(sanitized).not.toContain("f5-secret");
    expect(sanitized).toContain("127.0.0.1:55432");
    expect(sanitized).toContain(DB_NAME);
  });
});
