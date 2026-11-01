import { describe, expect, it } from "vitest";
import { APP_LINK_PATHS, appleAppSiteAssociation, assetLinks, parseFingerprints } from "./app-links";

describe("appleAppSiteAssociation", () => {
  it("lists AD-26 paths and /reset when a team id is configured", () => {
    const body = appleAppSiteAssociation("AB12CD34EF");
    expect(body.applinks.details).toEqual([
      { appID: "AB12CD34EF.app.giftlist.mobile", paths: [...APP_LINK_PATHS] },
    ]);
    expect(body.applinks.details[0]?.paths).toEqual(["/l/*", "/i/*", "/wishlist/*", "/reset"]);
    expect(body.webcredentials.apps).toEqual(["AB12CD34EF.app.giftlist.mobile"]);
  });

  it("returns empty target lists when the team id is missing", () => {
    const body = appleAppSiteAssociation(undefined);
    expect(body.applinks.details).toEqual([]);
    expect(body.webcredentials.apps).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("app.giftlist.mobile");
  });
});

describe("assetLinks", () => {
  it("returns an empty list without fingerprints", () => {
    expect(assetLinks([])).toEqual([]);
    expect(parseFingerprints(undefined)).toEqual([]);
    expect(parseFingerprints(" , ")).toEqual([]);
  });

  it("publishes one Android target for the comma-separated fingerprints", () => {
    expect(assetLinks(parseFingerprints(" AA:BB , CC:DD "))).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "app.giftlist.mobile",
          sha256_cert_fingerprints: ["AA:BB", "CC:DD"],
        },
      },
    ]);
  });
});
