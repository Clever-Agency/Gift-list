import type { InstallHintProps, InstallHintState } from "@/ui/install-hint.types";

export type { InstallHintProps, InstallHintState };

/** `UX-DR11`: the hint is a browser-only nudge; the phone app never shows it. */
export function InstallHint(_props: InstallHintProps): null {
  return null;
}

InstallHint.displayName = "InstallHint";

/**
 * The phone has no install hint, so there is nothing to remember: the screens can
 * call the same hook on both platforms and render the hint only when it is visible.
 */
export function useInstallHint(): InstallHintState {
  return { visible: false, dismiss: noop };
}

function noop() {
  // Nothing to close on the phone.
}
