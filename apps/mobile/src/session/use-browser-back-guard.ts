import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * The key the guard's own history entry carries. The entry repeats the form's
 * entry — same navigator `id`, same URL — so expo-router's history adapter keeps
 * reading the form's route from it (`global-state/browserHistoryAdapter.js` →
 * `readChange`); the flag only lets the guard tell its copy from the form.
 */
const SENTINEL = "giftFormGuard";

/** A navigator state object as the browser keeps it in one history entry. */
type EntryState = Record<string, unknown>;

export type BrowserBackGuard = {
  /** Repeats the browser back the guard blocked; `false` when it had none. */
  proceed(): boolean;
  /** Drops the blocked browser back: the form stays, the entry stays for the next Back. */
  cancel(): void;
  /** The screen leaves by itself: the browser's back that its own exit causes is no question. */
  allowLeave(): void;
  revokeLeave(): void;
};

function asState(value: unknown): EntryState {
  return typeof value === "object" && value !== null ? (value as EntryState) : {};
}

/**
 * The browser's own Back button on a dirty form (`EXPERIENCE.md` → Esc / scrim /
 * системное «назад»; «черновик формы не теряется молча»).
 *
 * React Navigation's `usePreventRemove` never sees it on web: the browser moves
 * to the previous entry first (a `popstate` with the URL already changed), and
 * expo-router then restores the navigation state from that URL — `browserHistory`
 * `restoreNavigationFromBrowser` — which is not a removal, so `beforeRemove`
 * never fires and the draft is dropped silently.
 *
 * So while the guard is open the page keeps one extra history entry of its own:
 * the browser's Back lands on that copy, the URL and the screen stay on the form,
 * and the screen shows «Сохранить изменения?». Every blocked Back pushes the copy
 * again, so the next Back stops here too, while the entry count stays the same
 * (`pushState` drops the forward entries). «Не сохранять» replays the Back by
 * `go(-2)`: one step to the form's own entry, the second to the page before it.
 * The copy is recognised by where the browser is, not by its state: the router
 * rewrites the entry it restores and keeps only its own id there. The cross keeps
 * both entries, so asking again costs nothing. A reload or a closed tab goes
 * through `beforeunload` and the browser's native question, but only while the
 * form is guarded: an own exit drops that listener before it moves the browser,
 * so crossing documents cannot raise the browser's question on top of the answer
 * the user has just given.
 *
 * Android and iOS never touch `window`: the navigator's own guard asks there.
 */
export function useBrowserBackGuard(
  enabled: boolean,
  onBlocked: () => void,
): BrowserBackGuard {
  // A blocked browser back is waiting for the screen's answer.
  const pending = useRef(false);
  // One of the screen's own ways out is under way (save, «Не сохранять», expired session).
  const leaving = useRef(false);
  // The entry the browser sits on is the guard's own copy, not the form's entry.
  // The copy repeats the form's state, so the router may rewrite it (and drop
  // `SENTINEL`): the position, not the state, is what tells the two apart.
  const onCopy = useRef(false);
  // The listener outlives renders, so it reads the screen's latest callback.
  const blocked = useRef(onBlocked);
  // While the guard is open, drops and re-arms its `beforeunload` listener; null
  // on native and when the guard is closed.
  const unload = useRef<{ attach(): void; detach(): void } | null>(null);

  useEffect(() => {
    blocked.current = onBlocked;
  }, [onBlocked]);

  useEffect(() => {
    if (!enabled || Platform.OS !== "web") return;

    const history = window.history;
    // The form's own entry, as it is when the guard opens: the copy repeats it.
    const current = { state: asState(history.state), url: window.location.href };

    /** Whether the entry the browser just selected is the form's own (not the copy). */
    function standsOnForm(state: EntryState): boolean {
      const id = current.state.id;
      // The navigator matches its entries by this id, so it is the form's identity.
      if (typeof id === "string") return state.id === id;
      return window.location.href === current.url;
    }

    function pushCopy(): void {
      history.pushState({ ...current.state, [SENTINEL]: true }, "", current.url);
      onCopy.current = true;
    }

    function onPopState(): void {
      // Our own exit: the router's `go(-1)` lands on the form's entry, not a Back.
      if (leaving.current) return;
      const state = asState(history.state);
      // Already on the copy (the guard pushed it on the last blocked Back).
      if (state[SENTINEL] === true) {
        onCopy.current = true;
        return;
      }
      // The traversal went past the form's entry: that way out is the router's.
      onCopy.current = false;
      if (!standsOnForm(state)) return;
      pending.current = true;
      // Push the copy again so this Back is consumed and the next one stops here too.
      pushCopy();
      blocked.current();
    }

    function onBeforeUnload(event: BeforeUnloadEvent): void {
      // A reload or a closed tab asks the browser's own question.
      event.preventDefault();
      event.returnValue = "";
    }

    // Both calls are idempotent: the DOM ignores a listener added twice and a
    // removal of one that is already gone.
    const unloadGuard = {
      attach(): void {
        window.addEventListener("beforeunload", onBeforeUnload);
      },
      detach(): void {
        window.removeEventListener("beforeunload", onBeforeUnload);
      },
    };
    unload.current = unloadGuard;

    pushCopy();
    window.addEventListener("popstate", onPopState);
    unloadGuard.attach();

    return () => {
      window.removeEventListener("popstate", onPopState);
      unloadGuard.detach();
      unload.current = null;
      pending.current = false;
      // A form that only became clean keeps the user on this page, so the copy
      // must go now: left on top, it would make their next Back go nowhere.
      // Our own exits leave it to the router's `go(-1)`, which consumes it and
      // skips no page; popping it here as well would jump one screen too far.
      const copied = onCopy.current;
      onCopy.current = false;
      if (!leaving.current && copied) history.back();
    };
  }, [enabled]);

  function proceed(): boolean {
    if (!pending.current) return false;
    pending.current = false;
    // The replay moves the browser itself: its popstate must not ask again, and
    // the `beforeunload` listener must be gone before the navigation crosses
    // documents, or the browser would ask its own question after this answer.
    leaving.current = true;
    unload.current?.detach();
    // The blocked Back already ate one copy of the form's entry and the guard
    // pushed another on top, so the page the user came from is two steps back.
    // The copy's state is not a reliable marker: the router rewrites the entry it
    // restores and keeps only its own id there, so the position is what counts.
    window.history.go(onCopy.current ? -2 : -1);
    return true;
  }

  function cancel(): void {
    pending.current = false;
  }

  function allowLeave(): void {
    leaving.current = true;
    pending.current = false;
    // Every own exit — a save, «Не сохранять», an expired session — is answered:
    // drop the listener before the caller navigates.
    unload.current?.detach();
  }

  function revokeLeave(): void {
    leaving.current = false;
    // The exit never happened: the still mounted dirty form is guarded again.
    unload.current?.attach();
  }

  return { proceed, cancel, allowLeave, revokeLeave };
}
