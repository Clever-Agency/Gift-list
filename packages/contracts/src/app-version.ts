import { z } from "zod";

/**
 * App update policy (CLE-86). The server answers it on the public
 * `GET /api/v1/app-version`, the native client compares its own version with
 * the answer, and raising `latestVersion`/`minSupportedVersion` is a plain
 * server deploy — no app rebuild (see
 * `_bmad-output/implementation-artifacts/spec-cle-86-obnovlenie-prilozheniya.md`).
 *
 * No React, Prisma or env here (AD-17, AD-26): both apps and the server read the
 * same constants and schemas, so the policy cannot drift between them.
 */

/**
 * A version is exactly `MAJOR.MINOR.PATCH`, each segment 1–9 ASCII digits. No
 * leading `v`, no `+build`, no spaces and no pre-release suffix: anything else
 * is an invalid answer and the client fails open. The cap also bounds the
 * length (at most 29 characters), so a hostile string cannot be long.
 */
export const APP_VERSION_PATTERN = /^\d{1,9}\.\d{1,9}\.\d{1,9}$/;

/** `0.1.0` is the first build of both stores and the default policy value. */
export const DEFAULT_APP_VERSION = "0.1.0";

const APP_VERSION_MAX_LENGTH = 29;

/** The two platforms that have a store listing; the web build is out of scope. */
export const APP_PLATFORMS = ["android", "ios"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

/**
 * One platform's policy. `storeUrl` is `https` or `null`, never a bare host: a
 * `null` store is a published-free state, not a reason to invent a marketplace
 * link. The schema is a plain `z.object` (not `strictObject`) on purpose: an
 * extra field added by a newer server must not make an old build reject the
 * answer and silently skip the check.
 */
export const appVersionPolicySchema = z.object({
  latestVersion: z.string().regex(APP_VERSION_PATTERN),
  minSupportedVersion: z.string().regex(APP_VERSION_PATTERN),
  storeUrl: z.url({ protocol: /^https$/ }).nullable(),
});

export type AppVersionPolicy = z.infer<typeof appVersionPolicySchema>;

/**
 * `data` of `GET /api/v1/app-version`: both platforms are required, and each
 * one must satisfy `minSupportedVersion <= latestVersion`. A violation is an
 * invalid answer (the server answers 500 and the client fails open), because a
 * blocking floor above the latest build can never be satisfied.
 */
export const appVersionDataSchema = z
  .object({ android: appVersionPolicySchema, ios: appVersionPolicySchema })
  .superRefine(function minNotAboveLatest(data, ctx) {
    for (const platform of APP_PLATFORMS) {
      const { latestVersion, minSupportedVersion } = data[platform];
      const order = compareAppVersions(minSupportedVersion, latestVersion);
      if (order === null || order > 0) {
        ctx.addIssue({
          code: "custom",
          path: [platform, "minSupportedVersion"],
          message: "minSupportedVersion must not be above latestVersion",
        });
      }
    }
  });

export type AppVersionData = z.infer<typeof appVersionDataSchema>;

export const APP_VERSION_STATUSES = ["UPDATE_SOFT", "UPDATE_BLOCK", "UP_TO_DATE"] as const;
export type AppVersionStatus = (typeof APP_VERSION_STATUSES)[number];

/**
 * Splits a version into three numbers, or `null` when the string does not match
 * {@link APP_VERSION_PATTERN}. Segments are compared as numbers, so `0.1.10` is
 * above `0.1.9`; leading zeros are accepted by the pattern and fold numerically
 * (`01.0.0` equals `1.0.0`).
 */
function parseAppVersion(value: string): [number, number, number] | null {
  if (value.length > APP_VERSION_MAX_LENGTH) return null;
  if (!APP_VERSION_PATTERN.test(value)) return null;
  const [major, minor, patch] = value.split(".").map(Number);
  return [major, minor, patch];
}

/**
 * Numeric comparison of two `MAJOR.MINOR.PATCH` strings. `-1` when `left` is
 * lower, `0` when equal, `1` when higher; `null` when either string is not a
 * version, so a caller cannot mistake an invalid input for "equal".
 */
export function compareAppVersions(left: string, right: string): -1 | 0 | 1 | null {
  const leftParts = parseAppVersion(left);
  const rightParts = parseAppVersion(right);
  if (leftParts === null || rightParts === null) return null;

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }
  return 0;
}

/**
 * The decision for one platform: below the floor is a blocking `UPDATE_BLOCK`,
 * below the latest but not blocked is a dismissible `UPDATE_SOFT`, the rest is
 * `UP_TO_DATE`.
 *
 * Fail open lives here on purpose: a missing or unreadable client version, an
 * invalid policy or a floor above the latest version all answer `UP_TO_DATE`,
 * so no client can block the app by forgetting a check.
 */
export function appVersionStatus(
  current: string | null,
  policy: AppVersionPolicy,
): AppVersionStatus {
  if (current === null) return "UP_TO_DATE";

  const parsedPolicy = appVersionPolicySchema.safeParse(policy);
  if (!parsedPolicy.success) return "UP_TO_DATE";

  const { latestVersion, minSupportedVersion } = parsedPolicy.data;
  const minToLatest = compareAppVersions(minSupportedVersion, latestVersion);
  if (minToLatest === null || minToLatest > 0) return "UP_TO_DATE";

  const toMin = compareAppVersions(current, minSupportedVersion);
  if (toMin === null) return "UP_TO_DATE";
  if (toMin < 0) return "UPDATE_BLOCK";

  const toLatest = compareAppVersions(current, latestVersion);
  if (toLatest === null) return "UP_TO_DATE";
  if (toLatest < 0) return "UPDATE_SOFT";

  return "UP_TO_DATE";
}

/**
 * Validates the packed-in policy and throws `ZodError` when it is invalid: the
 * constants are ours, so a broken one is a deploy-time programming error, not a
 * user-facing `NOT_FOUND`. The server action parses `APP_VERSION_POLICY` once
 * so a typo cannot leak into a 200 answer.
 */
export function parseAppVersionPolicy(value: unknown): AppVersionData {
  return appVersionDataSchema.parse(value);
}

/**
 * Default policy for both platforms: nobody is asked to update and no store
 * link exists until a listing is published. Raising either number before then
 * would show a dead end, so the defaults stay at the current build.
 */
export const APP_VERSION_POLICY: AppVersionData = parseAppVersionPolicy({
  android: {
    latestVersion: DEFAULT_APP_VERSION,
    minSupportedVersion: DEFAULT_APP_VERSION,
    storeUrl: null,
  },
  ios: {
    latestVersion: DEFAULT_APP_VERSION,
    minSupportedVersion: DEFAULT_APP_VERSION,
    storeUrl: null,
  },
});
