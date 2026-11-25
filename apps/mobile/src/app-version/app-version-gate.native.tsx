import * as Linking from "expo-linking";
import { useEffect, useState, type ReactNode } from "react";
import {
  INITIAL_APP_VERSION_STATE,
  createAppVersionChecker,
  type AppVersionState,
} from "@/app-version/check";
import { subscribeForeground } from "@/app-version/foreground";
import { AppUpdateBlockScreen } from "@/ui/app-update-block-screen";
import { AppUpdateSoftDialog } from "@/ui/app-update-soft-dialog";

export type AppVersionGateProps = {
  readonly children: ReactNode;
};

/** The store link is opened as is; a rejected or missing opener never throws. */
function openStoreUrl(storeUrl: string): void {
  try {
    void Linking.openURL(storeUrl).catch(function ignoreOpenError() {
      // No store app on the phone: the screen stays exactly as it is.
    });
  } catch {
    // A broken linking module is not a reason to crash the blocking screen.
  }
}

/**
 * CLE-86 (native): decides whether this build must be updated before the app is
 * usable.
 *
 * The gate draws `children` at once and checks in the background: a launch is
 * never held for the network, and a check that fails (offline, 5xx, a malformed
 * body, an unreadable build version) changes nothing. The rules live in
 * `@/app-version/check` and in `@gift-list/contracts`; this component only maps
 * the resulting state onto the two screens:
 *
 * - `soft` — the dismissible `AppUpdateSoftDialog` over the running app. Closing
 *   it (`dismiss`) remembers this `latestVersion` on the phone.
 * - `block` — `AppUpdateBlockScreen` instead of `children`: the app's tree is
 *   replaced, so no navigation or route can be reached under the blocking
 *   screen, and it closes nothing. A later failed check keeps it on screen.
 *
 * One check runs on mount and one on every return to the foreground
 * (`subscribeForeground`); `createAppVersionChecker` shares an in-flight request
 * and drops a stale answer, so a quick background/foreground bounce costs one
 * request.
 *
 * The web build resolves `app-version-gate.tsx` instead (see that file): the
 * browser has no check at all and none of this code reaches the web bundle.
 */
export function AppVersionGate({ children }: AppVersionGateProps) {
  const [state, setState] = useState<AppVersionState>(INITIAL_APP_VERSION_STATE);
  // One checker per launch: it owns the in-flight request, the attempt number and
  // the dismissal of this launch, so a re-render must not create a second one.
  const [checker] = useState(function createChecker() {
    return createAppVersionChecker({ onState: setState });
  });

  useEffect(
    function watchVersion() {
      void checker.check();
      return subscribeForeground(function recheckOnForeground() {
        void checker.check();
      });
    },
    [checker],
  );

  const storeUrl = state.status === "idle" ? null : state.storeUrl;

  function openStore(): void {
    if (storeUrl !== null) openStoreUrl(storeUrl);
  }

  function dismiss(): void {
    // The checker ignores this while blocking: only the soft offer closes.
    void checker.dismiss();
  }

  if (state.status === "block") {
    return <AppUpdateBlockScreen storeUrl={state.storeUrl} onOpenStore={openStore} />;
  }

  return (
    <>
      <AppUpdateSoftDialog
        visible={state.status === "soft"}
        storeUrl={storeUrl}
        onOpenStore={openStore}
        onDismiss={dismiss}
      />
      {children}
    </>
  );
}

AppVersionGate.displayName = "AppVersionGate";
