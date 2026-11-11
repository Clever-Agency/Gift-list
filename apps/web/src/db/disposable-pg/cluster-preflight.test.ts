import { describe, expect, it } from "vitest";
import {
  checkDisposableCluster,
  DisposablePgClusterRefusal,
  SUPPORTED_PG_MAJORS,
  type ClusterCheckInput,
} from "./cluster-preflight";

const UTF8 = "UTF8";

function refusalFrom(input: ClusterCheckInput): DisposablePgClusterRefusal {
  try {
    checkDisposableCluster(input);
  } catch (error) {
    expect(error).toBeInstanceOf(DisposablePgClusterRefusal);
    return error as DisposablePgClusterRefusal;
  }
  throw new Error("expected the cluster preflight to refuse this server");
}

describe("checkDisposableCluster", () => {
  it("supports PostgreSQL 17 and 18", () => {
    expect(SUPPORTED_PG_MAJORS).toEqual([17, 18]);
  });

  it.each<[string, number]>([
    ["17.11", 17],
    ["18.6", 18],
    ["18.6 (Debian 18.6-1.pgdg120+1)", 18],
    ["17.11 on x86_64-pc-linux-musl", 17],
  ])("reads the major from server_version %s", (serverVersion, major) => {
    const facts = checkDisposableCluster({ serverVersion, serverEncoding: UTF8 });

    expect(facts.major).toBe(major);
    expect(facts.serverVersion).toBe(serverVersion);
    expect(facts.serverEncoding).toBe(UTF8);
  });

  it.each(["UTF8", "utf8", "UTF-8", "utf-8"])(
    "accepts server_encoding %s",
    (serverEncoding) => {
      const facts = checkDisposableCluster({ serverVersion: "17.11", serverEncoding });

      expect(facts.major).toBe(17);
    },
  );

  it("refuses a major outside 17 and 18 and installs nothing", () => {
    const refusal = refusalFrom({ serverVersion: "16.9", serverEncoding: UTF8 });

    expect(refusal.code).toBe("unsupported-server-major");
    expect(refusal.message).toContain("16.9");
    expect(refusal.message).toContain("17 and 18");
    expect(refusal.message).toContain("installs nothing");
  });

  it("refuses an unparseable server_version", () => {
    expect(refusalFrom({ serverVersion: "PostgreSQL 17", serverEncoding: UTF8 }).code).toBe(
      "unrecognized-server-version",
    );
    expect(refusalFrom({ serverVersion: "", serverEncoding: UTF8 }).code).toBe(
      "unrecognized-server-version",
    );
  });

  it("refuses a WIN1251 cluster and names the UTF-8 fix", () => {
    const refusal = refusalFrom({ serverVersion: "18.6", serverEncoding: "WIN1251" });

    expect(refusal.code).toBe("server-encoding-not-utf8");
    expect(refusal.message).toContain("WIN1251");
    expect(refusal.message).toContain("22P05");
    expect(refusal.message).toContain("--encoding=UTF8");
    expect(refusal.message).toContain("POSTGRES_INITDB_ARGS");
    expect(refusal.message).toContain("Windows locale");
  });

  it("accepts any supported major when DISPOSABLE_PG_MAJOR is empty", () => {
    for (const pinnedMajor of [undefined, "", "   "]) {
      expect(
        checkDisposableCluster({ serverVersion: "18.6", serverEncoding: UTF8, pinnedMajor })
          .major,
      ).toBe(18);
    }
  });

  it("accepts a pin that matches the server", () => {
    expect(
      checkDisposableCluster({ serverVersion: "17.11", serverEncoding: UTF8, pinnedMajor: "17" })
        .major,
    ).toBe(17);
    expect(
      checkDisposableCluster({ serverVersion: "18.6", serverEncoding: UTF8, pinnedMajor: " 18 " })
        .major,
    ).toBe(18);
  });

  it("refuses a pin that does not match the server", () => {
    const refusal = refusalFrom({
      serverVersion: "17.11",
      serverEncoding: UTF8,
      pinnedMajor: "18",
    });

    expect(refusal.code).toBe("major-pin-mismatch");
    expect(refusal.message).toContain("pinned to 18");
    expect(refusal.message).toContain("17.11");
  });

  it.each(["16", "19", "17.11", "latest"])(
    "refuses DISPOSABLE_PG_MAJOR=%s",
    (pinnedMajor) => {
      const refusal = refusalFrom({
        serverVersion: "17.11",
        serverEncoding: UTF8,
        pinnedMajor,
      });

      expect(refusal.code).toBe("invalid-major-pin");
      expect(refusal.message).toContain("17 or 18");
    },
  );
});
