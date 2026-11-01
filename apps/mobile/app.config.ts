import type { ExpoConfig } from "expo/config";

/** Host of the public API origin. Empty or non-http(s) values claim no paths. */
export function appLinkHost(base: string): { hostname: string; port?: string } | null {
  const value = base.trim();
  if (value.length === 0) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname.length === 0) {
    return null;
  }
  return url.port.length > 0 ? { hostname: url.hostname, port: url.port } : { hostname: url.hostname };
}

/**
 * Prefixes match AD-26 (`/l/*`, `/i/*`, `/wishlist/*`) without swallowing
 * `/login` or `/invite`. `/reset` is exact so `/reset-password` stays in the browser.
 */
export function linkData(host: { hostname: string; port?: string }) {
  const base = {
    scheme: "https" as const,
    host: host.hostname,
    ...(host.port ? { port: host.port } : {}),
  };
  return [
    { ...base, pathPrefix: "/l/" },
    { ...base, pathPrefix: "/i/" },
    { ...base, path: "/wishlist" },
    { ...base, pathPrefix: "/wishlist/" },
    { ...base, path: "/reset" },
  ];
}

/**
 * Host of `EXPO_PUBLIC_API_BASE_URL` (the same variable as `getApiBaseUrl`).
 * Read here: Expo loads this file before Metro and does not resolve other TypeScript modules.
 * Empty or unparseable values add no associated domains or intent filters.
 */
const linkHost = appLinkHost(process.env.EXPO_PUBLIC_API_BASE_URL ?? "");

const config: ExpoConfig = {
  name: "Gift List",
  slug: "gift-list",
  scheme: "giftlist",
  version: "0.1.0",
  orientation: "default",
  userInterfaceStyle: "light",
  web: {
    output: "single",
    bundler: "metro",
    lang: "ru",
  },
  plugins: ["expo-router"],
  ios: {
    bundleIdentifier: "app.giftlist.mobile",
    ...(linkHost
      ? {
          associatedDomains: [
            `applinks:${linkHost.hostname}`,
            `webcredentials:${linkHost.hostname}`,
          ],
        }
      : {}),
  },
  android: {
    package: "app.giftlist.mobile",
    ...(linkHost
      ? {
          intentFilters: [
            {
              action: "VIEW",
              autoVerify: true,
              category: ["BROWSABLE", "DEFAULT"],
              data: linkData(linkHost),
            },
          ],
        }
      : {}),
  },
};

export default config;
