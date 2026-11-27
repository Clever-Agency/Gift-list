import { PRODUCT_NAME } from "@gift-list/contracts";
import { Platform } from "react-native";

function readPublic(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * An origin is scheme, host and optional port, nothing else. A bare hostname,
 * userinfo (`user:pass@host`), a backslash, a path, query, fragment or other
 * scheme is not an origin: a browser resolves `https://gift.example@evil.com`
 * to `evil.com`, so such values must not become a share link by accident.
 * Trailing slashes are allowed so `https://gift.example/` works.
 */
const WEB_ORIGIN = /^(https?:\/\/(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?)\/*$/i;

/** ` https://gift.example/ ` → `https://gift.example`; anything else → "" (no wrong host). */
export function normalizeWebOrigin(value: string | undefined): string {
  const match = WEB_ORIGIN.exec(readPublic(value));
  if (!match) return "";
  const port = match[2];
  if (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) return "";
  return match[1];
}

/**
 * Display name (AD-24): `EXPO_PUBLIC_BRAND_NAME` is a deliberate override, and a
 * blank or missing value falls back to the one constant in `packages/contracts`.
 */
export function getBrandName(): string {
  const value = readPublic(process.env.EXPO_PUBLIC_BRAND_NAME);
  return value.length > 0 ? value : PRODUCT_NAME;
}

/** Empty means "not configured". Callers show the catalog phrase and do not throw. */
export function getApiBaseUrl(): string {
  return readPublic(process.env.EXPO_PUBLIC_API_BASE_URL);
}

/**
 * A store address is an absolute `https` URL with a host: the install hint links
 * to it as-is, and a plain `http` or a relative value must not become a link.
 * A trailing slash and a long query stay — the store owns its own URL shape.
 */
const HTTPS_URL = /^https:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i;

/** ` https://play.google.com/... ` → the URL; anything that is not `https` → "". */
export function normalizeStoreUrl(value: string | undefined): string {
  const url = readPublic(value);
  return HTTPS_URL.test(url) ? url : "";
}

/**
 * Google Play is the first store (UX-DR11): the link exists only when the build
 * hands an address, so a missing value never invents a listing.
 */
export function getAndroidStoreUrl(): string {
  return normalizeStoreUrl(process.env.EXPO_PUBLIC_ANDROID_STORE_URL);
}

/** The App Store address; the hint shows it only with {@link isIosAppPublished}. */
export function getIosStoreUrl(): string {
  return normalizeStoreUrl(process.env.EXPO_PUBLIC_IOS_STORE_URL);
}

/**
 * The iOS release switch (UX-DR11, AD-26): the App Store link appears without a
 * code change once the app is published. `true` and `1` are the accepted values;
 * everything else, including a missing variable, means "not published yet".
 */
export function isIosAppPublished(): boolean {
  const value = readPublic(process.env.EXPO_PUBLIC_IOS_APP_PUBLISHED).toLowerCase();
  return value === "true" || value === "1";
}

/**
 * Origin of the page that runs the web build. The site and the API share that
 * domain (AD-26), so it is the same public origin without a configured value.
 * React Native defines `window` as the global object, so the platform check
 * matters: native has no `location` and must keep env-only semantics.
 */
function readPageOrigin(): string {
  if (Platform.OS !== "web" || typeof window === "undefined") return "";
  const origin = window.location?.origin;
  return typeof origin === "string" ? origin : "";
}

/**
 * Public site origin for outbound links (AD-26, D-48). `EXPO_PUBLIC_WEB_ORIGIN`
 * wins; when it is empty the API origin is used, because the site and the API
 * share one domain and App Links claim `/l/*` there. On the web the current
 * page origin is the last resort: a deployed SPA is served from that same
 * domain, so no domain is baked in and no localhost is assumed. A set but
 * invalid value does not fall back: it returns "" instead of guessing a
 * different host.
 */
export function resolvePublicWebOrigin(
  configured: string | undefined,
  apiBase: string | undefined,
  pageOrigin: string | undefined = readPageOrigin(),
): string {
  if (readPublic(configured).length > 0) return normalizeWebOrigin(configured);
  // A non-empty API base is trusted or rejected as a whole: falling through on
  // a typo could point links at a host nobody configured. The page origin is
  // used only when both configured values are truly absent.
  if (readPublic(apiBase).length > 0) return normalizeWebOrigin(apiBase);
  return normalizeWebOrigin(pageOrigin);
}

/** Empty means "not configured": callers must not build or copy a link from it. */
export function getPublicWebOrigin(): string {
  return resolvePublicWebOrigin(
    process.env.EXPO_PUBLIC_WEB_ORIGIN,
    process.env.EXPO_PUBLIC_API_BASE_URL,
  );
}
