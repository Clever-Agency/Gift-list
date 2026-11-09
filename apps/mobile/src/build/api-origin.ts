/**
 * Build-time check for the SPA API origin (R2).
 *
 * The Expo web export bakes `EXPO_PUBLIC_API_BASE_URL` into the JS bundle. A
 * bundle built for the Android emulator (`http://10.0.2.2:...`) works there and
 * nowhere else: a phone, another laptop or a deployed site cannot resolve that
 * host. These origin checks are used by the mobile build CLI, so a web/LAN build
 * never ships that origin by accident. The post-export bundle scan lives in
 * `scripts/emulator-origin.mjs`, outside both apps, so no script has to import
 * another package's TypeScript. These helpers stay free of Node APIs to be
 * testable and importable from the build scripts (Node 24 strips the types on
 * import).
 */

export type SpaBuildMode = "web" | "lan" | "emulator";

/** Hosts that only mean "the host machine" inside the Android emulator. */
export const EMULATOR_HOSTS = ["10.0.2.2"] as const;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type OriginCheck = {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
};

export type OriginEnv = {
  readonly apiBase?: string;
  readonly webOrigin?: string;
};

function read(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Host of an http(s) origin, or null when the value is not a bare origin. */
export function originHost(value: string | undefined): string | null {
  const raw = read(value);
  if (raw.length === 0) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.hostname.length === 0) return null;
  // A path, query or fragment would make this a URL, not an origin.
  if (raw.replace(/\/+$/, "") !== url.origin) return null;
  return url.hostname.toLowerCase();
}

function isOrigin(value: string): boolean {
  return originHost(value) !== null;
}

function isEmulatorHost(host: string | null): boolean {
  return host !== null && (EMULATOR_HOSTS as readonly string[]).includes(host);
}

function isLoopbackHost(host: string | null): boolean {
  return host !== null && LOOPBACK_HOSTS.has(host);
}

/**
 * Checks the values that will be baked into a bundle. `web` is same-origin by
 * default (the Next server serves both the SPA and `/api/v1`), `lan` must name a
 * reachable host other than the emulator alias, and `emulator` may use it.
 */
export function validateBuildOrigins(
  mode: SpaBuildMode,
  env: OriginEnv,
): OriginCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const apiBase = read(env.apiBase);
  const webOrigin = read(env.webOrigin);

  if (mode === "emulator") {
    if (apiBase.length > 0 && !isOrigin(apiBase)) {
      errors.push(
        `EXPO_PUBLIC_API_BASE_URL must be an http(s) origin without a path, got "${apiBase}".`,
      );
    }
    if (apiBase.length === 0) {
      warnings.push(
        "EXPO_PUBLIC_API_BASE_URL is empty for the emulator build; the app will call the same origin as the page.",
      );
    }
    return { errors, warnings };
  }

  if (apiBase.length > 0) {
    const apiHost = originHost(apiBase);
    if (apiHost === null) {
      errors.push(
        `EXPO_PUBLIC_API_BASE_URL must be an http(s) origin without a path, got "${apiBase}".`,
      );
    } else if (isEmulatorHost(apiHost)) {
      errors.push(
        `The ${mode} build must not use the emulator origin "${apiBase}": 10.0.2.2 works only inside the Android emulator. Use the LAN address for a LAN build, or leave the value empty for a same-origin web build.`,
      );
    } else if (mode === "lan" && isLoopbackHost(apiHost)) {
      errors.push(
        `The LAN build must not use the loopback origin "${apiBase}": another device cannot reach localhost. Set EXPO_PUBLIC_API_BASE_URL to the host's LAN address, e.g. http://192.168.1.20:3000.`,
      );
    } else if (mode === "web") {
      warnings.push(
        `The web build is served same-origin by Next.js; EXPO_PUBLIC_API_BASE_URL="${apiBase}" is baked in and overrides that. Leave it empty unless the API really lives on another domain.`,
      );
    }
  } else if (mode === "lan") {
    errors.push(
      "EXPO_PUBLIC_API_BASE_URL is required for a LAN build: set it to the host's LAN address, e.g. http://192.168.1.20:3000.",
    );
  }

  if (webOrigin.length > 0) {
    const webHost = originHost(webOrigin);
    if (webHost === null) {
      errors.push(
        `EXPO_PUBLIC_WEB_ORIGIN must be an http(s) origin without a path, got "${webOrigin}".`,
      );
    } else if (isEmulatorHost(webHost)) {
      errors.push(
        `The ${mode} build must not bake the emulator origin "${webOrigin}" into share links: 10.0.2.2 is not reachable from a phone or another browser.`,
      );
    } else if (mode === "lan" && isLoopbackHost(webHost)) {
      errors.push(
        `Share links in a LAN build must not point at "${webOrigin}": another device cannot reach localhost.`,
      );
    }
  }

  return { errors, warnings };
}
