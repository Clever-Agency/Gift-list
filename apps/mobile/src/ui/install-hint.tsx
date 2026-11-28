import { View } from "@gift-list/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAndroidStoreUrl, getIosStoreUrl, isIosAppPublished } from "@/config/env";
import { InstallHintView } from "@/ui/install-hint-view";
import {
  dismissInstallHint,
  isInstallHintDismissed,
  subscribeInstallHint,
} from "@/ui/install-hint-storage";
import type { InstallHintProps, InstallHintState } from "@/ui/install-hint.types";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** `Node.DOCUMENT_POSITION_FOLLOWING` without reading the global in a test. */
const DOCUMENT_POSITION_FOLLOWING = 4;

export type { InstallHintProps, InstallHintState };

/**
 * The remembered state of the install hint (UX-DR11). The marker is read on the
 * first render, so a closed hint never flashes before the effect runs; the write
 * happens on the cross, not on mount.
 */
export function useInstallHint(): InstallHintState {
  const [visible, setVisible] = useState(function readMarker() {
    return !isInstallHintDismissed();
  });

  // A hint closed on another mounted screen hides this one too (a tab stack
  // keeps the previous screen alive), so switching tabs never restores it.
  useEffect(function followDismissal() {
    return subscribeInstallHint(function hide() {
      setVisible(false);
    });
  }, []);

  const dismiss = useCallback(function dismiss() {
    dismissInstallHint();
    setVisible(false);
  }, []);

  return { visible, dismiss };
}

/**
 * The first control after `from` in the document, skipping the hint itself: the
 * cross takes the hint away, so focus must not land on `body` (`DESIGN.md` →
 * Куда уходит фокус). When the hint is the last thing on the page, the screen
 * title is the fallback the accessibility rules name.
 */
function findNextFocusable(from: HTMLElement | null): HTMLElement | null {
  if (from === null) return null;
  // The screen's own controls only: the tab bar below `main` is not «the next
  // element of the screen», and the title is the documented fallback instead.
  const scope = from.closest<HTMLElement>("#main-content") ?? document;
  const focusables = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE));
  const next = focusables.find(function followsHint(node) {
    if (node === from || from.contains(node)) return false;
    return (from.compareDocumentPosition(node) & DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  if (next !== undefined) return next;

  const heading = document.querySelector<HTMLElement>('[role="heading"][aria-level="1"]');
  if (heading !== null) {
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    return heading;
  }
  return document.querySelector<HTMLElement>("#main-content, [role='main']");
}

/**
 * The browser half of Story 6.5: the hint itself. The addresses and the iOS flag
 * come from the build environment (`config/env`), so a store listing changes
 * without a code change. `install-hint.native.tsx` is the twin of the phone: it
 * renders nothing (UX-DR11).
 */
export function InstallHint({ onClose, testID = "install-hint" }: InstallHintProps) {
  const frame = useRef<HTMLElement | null>(null);

  function close() {
    const next = findNextFocusable(frame.current);
    onClose();
    setTimeout(function moveFocus() {
      next?.focus();
    }, 0);
  }

  return (
    <View ref={frame as never} width="100%">
      <InstallHintView
        androidUrl={getAndroidStoreUrl()}
        iosUrl={getIosStoreUrl()}
        iosPublished={isIosAppPublished()}
        onClose={close}
        testID={testID}
      />
    </View>
  );
}

InstallHint.displayName = "InstallHint";
