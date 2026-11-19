import {
  APP_VERSION_PATTERN,
  appVersionDataSchema,
  appVersionStatus,
  type AppPlatform,
  type AppVersionData,
} from "@gift-list/contracts";
import { fetchAppVersionPolicy } from "@/api/app-version";
import type { ClientResult } from "@/api/client";
import { currentAppVersion } from "@/app-version/current-version";
import { readDismissedVersion, writeDismissedVersion } from "@/app-version/dismissed";
import { appVersionPlatform } from "@/app-version/platform";

/**
 * CLE-86: client-side decision of «Доступно обновление» / «Обновите приложение».
 *
 * The policy itself is never duplicated here: it comes from the public
 * `GET /api/v1/app-version` answer, and the rules live in
 * `@gift-list/contracts/src/app-version.ts` (`appVersionStatus`,
 * `compareAppVersions`). This module only turns the answer into the gate state,
 * remembers a closed soft offer and serialises the requests.
 *
 * Everything fails open (see the matrix in
 * `_bmad-output/implementation-artifacts/spec-cle-86-obnovlenie-prilozheniya.md`):
 * a missing client version, the web platform, a network error, a non-envelope
 * body, a policy that does not parse, an unreadable dismissal store — none of
 * them shows or hides anything on their own. A displayed block is never removed
 * by a failed check.
 */

/** What the gate renders: nothing, a dismissible dialog or the blocking screen. */
export type AppVersionState =
  | { readonly status: "idle" }
  | {
      readonly status: "soft";
      readonly latestVersion: string;
      readonly storeUrl: string | null;
    }
  | {
      readonly status: "block";
      readonly latestVersion: string;
      readonly storeUrl: string | null;
    };

export const INITIAL_APP_VERSION_STATE: AppVersionState = { status: "idle" };

/**
 * One checked answer. `ok: false` is the single fail-open outcome: a skipped
 * request (web, unreadable client version) and any unusable answer look the
 * same to the caller, and `resolveAppVersion` keeps the current state.
 */
export type AppVersionCheck =
  | {
      readonly ok: true;
      readonly data: AppVersionData;
      readonly platform: AppPlatform;
      readonly currentVersion: string;
      readonly dismissedVersion: string | null;
    }
  | { readonly ok: false };

/** The side effects the check needs; injectable so the decision is testable. */
export type AppVersionDeps = {
  readonly platform: () => AppPlatform | null;
  readonly currentVersion: () => string | null;
  readonly fetchPolicy: () => Promise<ClientResult<unknown>>;
  readonly readDismissedVersion: () => Promise<string | null>;
};

/** The real side effects: the policy request, the build version, the phone. */
export const APP_VERSION_DEPS: AppVersionDeps = {
  platform: appVersionPlatform,
  currentVersion: currentAppVersion,
  fetchPolicy: fetchAppVersionPolicy,
  readDismissedVersion,
};

/**
 * The pure decision for one platform. A failed check leaves `state` untouched,
 * which is what keeps an already displayed block on screen. A blocking answer
 * wins over the dismissal record by construction (it is checked first), and the
 * soft offer is suppressed only for the exact `latestVersion` that was closed:
 * a newer policy asks once again.
 */
export function resolveAppVersion(
  state: AppVersionState,
  check: AppVersionCheck,
): AppVersionState {
  if (!check.ok) return state;

  const policy = check.data[check.platform];
  const status = appVersionStatus(check.currentVersion, policy);

  if (status === "UPDATE_BLOCK") {
    return {
      status: "block",
      latestVersion: policy.latestVersion,
      storeUrl: policy.storeUrl,
    };
  }

  if (status === "UPDATE_SOFT" && check.dismissedVersion !== policy.latestVersion) {
    return {
      status: "soft",
      latestVersion: policy.latestVersion,
      storeUrl: policy.storeUrl,
    };
  }

  return INITIAL_APP_VERSION_STATE;
}

/**
 * Runs one request and validates everything the decision depends on.
 *
 * The client version is checked before the request: an unreadable version is
 * `FAIL_OPEN_NO_VERSION`, so there is nothing to compare and no reason to hit
 * the network. A failed or invalid answer is `ok: false`; a failed dismissal
 * read is not a failure, because a broken store must not hide the offer.
 */
export async function attemptAppVersionCheck(
  deps: AppVersionDeps,
): Promise<AppVersionCheck> {
  const platform = deps.platform();
  if (platform === null) return { ok: false };

  const currentVersion = deps.currentVersion();
  if (currentVersion === null || !APP_VERSION_PATTERN.test(currentVersion)) {
    return { ok: false };
  }

  let result: ClientResult<unknown>;
  try {
    result = await deps.fetchPolicy();
  } catch {
    return { ok: false };
  }
  if (!result.ok) return { ok: false };

  const parsed = appVersionDataSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false };

  let dismissedVersion: string | null = null;
  try {
    dismissedVersion = await deps.readDismissedVersion();
  } catch {
    dismissedVersion = null;
  }

  return {
    ok: true,
    data: parsed.data,
    platform,
    currentVersion,
    dismissedVersion,
  };
}

export type AppVersionCheckerOptions = {
  /** Called on every applied state change, the way React state is set. */
  readonly onState?: (state: AppVersionState) => void;
  readonly deps?: AppVersionDeps;
};

/**
 * The gate-facing orchestration of CLE-86.
 *
 * One request at a time: a second `check()` while a request is in flight shares
 * it instead of sending a duplicate, which is what a quick background/foreground
 * bounce does. Each started attempt gets a number and only the newest one may
 * apply its answer, so an outdated response cannot overwrite a newer decision.
 *
 * `dismiss()` closes the soft offer for good: the state becomes idle at once and
 * the `latestVersion` is remembered on the phone. A blocking state is not
 * dismissible: `dismiss()` is a no-op and the block keeps ignoring the record.
 */
export type AppVersionChecker = {
  readonly getState: () => AppVersionState;
  readonly check: () => Promise<AppVersionState>;
  readonly dismiss: () => Promise<AppVersionState>;
};

export function createAppVersionChecker(
  options: AppVersionCheckerOptions = {},
): AppVersionChecker {
  const deps = options.deps ?? APP_VERSION_DEPS;
  let state = INITIAL_APP_VERSION_STATE;
  let inFlight: Promise<AppVersionState> | null = null;
  let attempt = 0;
  // A closed offer is closed for this launch too, not only after the write
  // lands: a check already in flight must not bring the dialog back.
  let sessionDismissedVersion: string | null = null;

  function apply(next: AppVersionState): AppVersionState {
    state = next;
    options.onState?.(next);
    return next;
  }

  function withSessionDismissal(check: AppVersionCheck): AppVersionCheck {
    if (!check.ok) return check;
    const latestVersion = check.data[check.platform].latestVersion;
    if (sessionDismissedVersion !== latestVersion) return check;
    return { ...check, dismissedVersion: latestVersion };
  }

  async function runAttempt(): Promise<AppVersionState> {
    attempt += 1;
    const id = attempt;
    const check = withSessionDismissal(await attemptAppVersionCheck(deps));
    // A newer attempt owns the state; this answer is stale.
    if (id !== attempt) return state;
    return apply(resolveAppVersion(state, check));
  }

  function check(): Promise<AppVersionState> {
    if (inFlight !== null) return inFlight;

    const promise = runAttempt().finally(function clearInFlight() {
      inFlight = null;
    });
    inFlight = promise;
    return promise;
  }

  async function dismiss(): Promise<AppVersionState> {
    if (state.status !== "soft") return state;

    const latestVersion = state.latestVersion;
    sessionDismissedVersion = latestVersion;
    apply(INITIAL_APP_VERSION_STATE);
    try {
      await writeDismissedVersion(latestVersion);
    } catch {
      // A failed write only means the offer returns after the next launch.
    }
    return state;
  }

  function getState(): AppVersionState {
    return state;
  }

  return { check, dismiss, getState };
}
