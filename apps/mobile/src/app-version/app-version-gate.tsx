import type { ReactNode } from "react";

export type AppVersionGateProps = {
  readonly children: ReactNode;
};

/**
 * CLE-86 web twin of the update gate.
 *
 * The browser build has no version check at all: the page updates with a
 * reload, so no request is made, nothing is subscribed to and the tree is
 * rendered exactly as it was. That is also why the gate is a pair of files:
 * Metro takes `app-version-gate.native.tsx` on Android and iOS and this
 * eleven-line twin on the web, so the checker, the dialog, the blocking screen
 * and their imports never reach the web bundle (the exported browser SPA is
 * generated from this build, and its size is budgeted).
 *
 * On native the check itself fails open too (see `@/app-version/check`): a
 * missing version, a failed request or an unreadable answer all leave the app
 * as it is.
 */
export function AppVersionGate({ children }: AppVersionGateProps) {
  return <>{children}</>;
}

AppVersionGate.displayName = "AppVersionGate";
