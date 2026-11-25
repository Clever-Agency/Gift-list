import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appVersionDataSchema } from "@gift-list/contracts";

vi.mock("server-only", () => ({}));

/**
 * CLE-86: `GET /api/v1/app-version` is public data — no session, no database.
 * Both modules are mocked so that an accidental import fails loudly instead of
 * quietly reading a cookie or opening a connection.
 */
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: function getSession() {
        throw new Error("app-version must not read the session");
      },
    },
  },
}));

vi.mock("@/db/client", () => ({
  prisma: new Proxy(
    {},
    {
      get: function refuseDatabaseRead() {
        throw new Error("app-version must not read the database");
      },
    },
  ),
}));

const { brokenPolicy } = vi.hoisted(() => ({
  brokenPolicy: { value: false, error: new Error("broken app version constants") },
}));

/**
 * The route, the use-case and the real default constants stay in the test; only
 * the parser is a switch, so the "broken constants" case can be replayed
 * without editing `packages/contracts`.
 */
vi.mock("@gift-list/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gift-list/contracts")>();
  return {
    ...actual,
    parseAppVersionPolicy: function parseAppVersionPolicy(value: unknown) {
      if (brokenPolicy.value) throw brokenPolicy.error;
      return actual.parseAppVersionPolicy(value);
    },
  };
});

const expected = {
  android: { latestVersion: "0.1.0", minSupportedVersion: "0.1.0", storeUrl: null },
  ios: { latestVersion: "0.1.0", minSupportedVersion: "0.1.0", storeUrl: null },
};

beforeEach(() => {
  brokenPolicy.value = false;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/v1/app-version", () => {
  it("answers the default policy for both platforms without a session or a database", async () => {
    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: expected });
    expect(appVersionDataSchema.safeParse(expected).success).toBe(true);
  });

  it("answers broken constants with a bare 500 instead of NOT_FOUND", async () => {
    brokenPolicy.value = true;
    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-type")).toBeNull();
    expect(await res.text()).toBe("");
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "App version policy read failed",
      brokenPolicy.error,
    );
  });

  it("answers unsupported methods with the NOT_FOUND envelope", async () => {
    const { POST, PUT, PATCH, DELETE, HEAD } = await import("./route");
    const handlers: Array<[string, (request?: Request) => Response]> = [
      ["POST", POST],
      ["PUT", PUT],
      ["PATCH", PATCH],
      ["DELETE", DELETE],
      ["HEAD", HEAD],
    ];
    for (const [method, handler] of handlers) {
      const res = handler(new Request("http://x/api/v1/app-version", { method }));
      expect(res.status, method).toBe(404);
      expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    }
  });

  it("is served by its own static segment, not the /api/v1 catch-all", async () => {
    const real = await import("./route");
    const catchAll = await import("../[...slug]/route");
    const url = "http://x/api/v1/app-version";

    const realRes = await real.GET();
    expect(realRes.status).toBe(200);
    expect(await realRes.json()).toEqual({ ok: true, data: expected });

    // A static segment wins over `[...slug]` in the App Router, so this file is
    // the handler for the path. Pinning the catch-all answer keeps the
    // difference visible: were the static route gone, the path would answer
    // NOT_FOUND here.
    const catchAllRes = await catchAll.GET(new Request(url));
    expect(catchAllRes.status).toBe(404);
    expect(await catchAllRes.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
  });
});
