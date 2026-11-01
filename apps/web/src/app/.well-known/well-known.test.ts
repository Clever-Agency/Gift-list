import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEnv } = vi.hoisted(() => ({ getEnv: vi.fn() }));

vi.mock("@/lib/env", () => ({ getEnv }));

import { GET as apple } from "./apple-app-site-association/route";
import { GET as assetlinks } from "./assetlinks.json/route";

beforeEach(() => {
  getEnv.mockReset();
});

describe("well-known app links", () => {
  it("serves empty targets when the env values are unset", async () => {
    getEnv.mockReturnValue({});
    const appleBody = await (await apple()).json();
    const androidBody = await (await assetlinks()).json();
    expect(appleBody.applinks.details).toEqual([]);
    expect(appleBody.webcredentials.apps).toEqual([]);
    expect(androidBody).toEqual([]);
    expect(JSON.stringify(appleBody)).not.toMatch(/[A-Z0-9]{10}\.app\.giftlist/);
  });

  it("advertises /l/*, /i/*, /wishlist/* and /reset from env only", async () => {
    getEnv.mockReturnValue({
      APPLE_TEAM_ID: "AB12CD34EF",
      ANDROID_SHA256_CERT_FINGERPRINTS: "AA:BB",
    });
    const appleBody = await (await apple()).json();
    const androidBody = await (await assetlinks()).json();
    expect(appleBody.applinks.details[0].paths).toEqual(["/l/*", "/i/*", "/wishlist/*", "/reset"]);
    expect(appleBody.applinks.details[0].appID).toBe("AB12CD34EF.app.giftlist.mobile");
    expect(androidBody[0].target.sha256_cert_fingerprints).toEqual(["AA:BB"]);
    expect(androidBody[0].target.package_name).toBe("app.giftlist.mobile");
  });
});
