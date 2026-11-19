import "server-only";

import {
  APP_VERSION_POLICY,
  parseAppVersionPolicy,
  type ActionResult,
  type AppVersionData,
} from "@gift-list/contracts";

/**
 * CLE-86: the app update policy for both store platforms.
 *
 * The policy is public data (two versions and an optional store link) and lives
 * in `@gift-list/contracts`, so raising `latestVersion` or
 * `minSupportedVersion` is a plain server deploy: no database row, no env
 * variable and no app rebuild. The endpoint is public because the check runs
 * before (and independently of) sign-in.
 *
 * `parseAppVersionPolicy` runs on every call even though the constant was
 * validated at import: a typo in the constants is a programming error, so this
 * function throws instead of answering `NOT_FOUND`, and the route maps the
 * throw to a bare 500. The client treats a non-envelope body as a network
 * failure and fails open, which is the sanctioned behavior for CLE-86.
 */
export async function getAppVersionPolicy(): Promise<ActionResult<AppVersionData>> {
  return { ok: true, data: parseAppVersionPolicy(APP_VERSION_POLICY) };
}
