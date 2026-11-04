import { usePreventRemove } from "expo-router/react-navigation";
import { useRef } from "react";
import { useBrowserBackGuard } from "@/session/use-browser-back-guard";

/**
 * Blocks the navigator's own way out of a dirty form — Android hardware back,
 * the predictive-back gesture, the header's back — and hands the blocked action
 * to the screen (`EXPERIENCE.md` → Esc / scrim / системное «назад»). The screen's
 * «Отмена» is a plain button and never passes through here.
 *
 * On web the browser's own Back button changes the URL before the navigator can
 * see it, so `usePreventRemove` alone misses it; `useBrowserBackGuard` keeps the
 * page on the form and reports the Back through the same `onBlocked`. Native
 * keeps exactly the navigator's behaviour (see that hook).
 *
 * `proceed()` replays the action the user asked for — the navigator's blocked
 * removal or the browser's Back — so the way out stays exactly what they meant;
 * `cancel()` drops it when the screen decides the draft is kept after all. The
 * browser's replay removes this screen through the router, so it arms the same
 * bypass as an own exit: otherwise the router would stop its own restoration and
 * ask the question a second time.
 *
 * The screen's own deliberate exits (saved, discarded, clean form, expired
 * session) call `allowNextLeave()` right before navigating: the navigator reads
 * the bypass from a ref, so it holds in the same tick even though `enabled` comes
 * from the last committed render, and the browser guard in turn knows that the
 * popstate of that exit is not a Back to ask about. `revokeLeave()` drops a
 * bypass whose way out never happened (a failed sign-out), so the still mounted
 * form is guarded again.
 */
export function useDiscardGuard(
  enabled: boolean,
  onBlocked: () => void,
): { proceed(): boolean; cancel(): void; allowNextLeave(): void; revokeLeave(): void } {
  const pending = useRef<(() => void) | null>(null);
  const bypass = useRef(false);
  const browser = useBrowserBackGuard(enabled, onBlocked);

  usePreventRemove(enabled, (event) => {
    if (bypass.current) {
      bypass.current = false;
      pending.current = null;
      // `repeat` turns prevention off for this route and replays the action in
      // one synchronous step: a plain dispatch would be stopped a second time.
      event.repeat();
      return;
    }
    pending.current = event.repeat;
    onBlocked();
  });

  function proceed(): boolean {
    const repeat = pending.current;
    pending.current = null;
    if (repeat) {
      // The router's own back follows this replay on web: it is not a new question.
      browser.allowLeave();
      repeat();
      return true;
    }
    // The browser's Back is replayed by moving the page to the entry before the
    // form, and the navigator reads that move as a removal of this screen. The
    // same bypass every own exit uses lets the removal through: without it the
    // router stops it, puts the browser back on the form and asks the question
    // again. `proceed()` answers `false` when no Back waits, so the screen's own
    // way out takes over and arms the bypass itself.
    bypass.current = true;
    if (browser.proceed()) return true;
    bypass.current = false;
    return false;
  }

  function cancel(): void {
    pending.current = null;
    browser.cancel();
  }

  function allowNextLeave(): void {
    bypass.current = true;
    browser.allowLeave();
  }

  function revokeLeave(): void {
    bypass.current = false;
    browser.revokeLeave();
  }

  return { proceed, cancel, allowNextLeave, revokeLeave };
}
