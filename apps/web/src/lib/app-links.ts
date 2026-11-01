/** Paths App Links and Universal Links open in the app (AD-26 plus `/reset`). */
export const APP_LINK_PATHS = ["/l/*", "/i/*", "/wishlist/*", "/reset"] as const;

export const APP_BUNDLE_ID = "app.giftlist.mobile";

export function parseFingerprints(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/** Apple association. A missing team id yields empty target lists, never a made-up id. */
export function appleAppSiteAssociation(teamId: string | undefined) {
  const appId = teamId ? `${teamId}.${APP_BUNDLE_ID}` : null;
  return {
    applinks: {
      apps: [] as string[],
      details: appId ? [{ appID: appId, paths: [...APP_LINK_PATHS] }] : [],
    },
    webcredentials: {
      apps: appId ? [appId] : [],
    },
  };
}

/** Digital Asset Links. No fingerprints → an empty statement list. */
export function assetLinks(fingerprints: readonly string[]) {
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: APP_BUNDLE_ID,
        sha256_cert_fingerprints: [...fingerprints],
      },
    },
  ];
}
