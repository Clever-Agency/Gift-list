import { useEffect, useState } from "react";

/**
 * Story 5.3 (D-43, ARCH-A5): the undo window belongs to the server. The owner's
 * closed card carries `undoUntil` — the moment the window ends — and the client
 * only counts the rest of it. The ten minutes are not repeated here, so a change
 * of `UNDO_WINDOW` on the server needs no client release.
 *
 * The remainder is re-read every 30 seconds: a minute shown by `DESIGN.md`
 * («ещё {minutes} мин») is whole and rounded up, so half a minute never turns
 * the label into a lie. Once the moment has passed, the ticker stops instead of
 * waking the screen forever; a late undo is refused by the server anyway.
 */
const REFRESH_MS = 30_000;

const MINUTE_MS = 60_000;

/** Что показать на закрытой карточке и в диалоге подробностей. */
export type UndoWindow = {
  /** Миллисекунды до конца окна; 0, когда окно закрыто. */
  remainingMs: number;
  /** Целые минуты до конца окна, округлённые вверх; 0, когда окно закрыто. */
  minutes: number;
  /** Момент сервера ещё в будущем: кнопки «Вернуть в открытые» есть. */
  open: boolean;
};

const CLOSED: UndoWindow = { remainingMs: 0, minutes: 0, open: false };

type Clock = {
  /** Серверный момент, для которого прочитаны часы. */
  target: number | null;
  /** Показания часов в этот момент. */
  now: number;
};

/** `undoUntil` — ISO-момент с сервера; всё остальное считается закрытым окном. */
function targetMoment(undoUntil: string | null | undefined): number | null {
  if (typeof undoUntil !== "string" || undoUntil.length === 0) return null;
  const moment = Date.parse(undoUntil);
  return Number.isNaN(moment) ? null : moment;
}

function readNow(): number {
  return Date.now();
}

export function useUndoWindow(undoUntil: string | null | undefined): UndoWindow {
  const target = targetMoment(undoUntil);
  const [clock, setClock] = useState<Clock>(() => ({ target, now: readNow() }));

  useEffect(
    function followUndoWindow() {
      if (target === null) return undefined;

      // The card may arrive long after this hook mounted, so the stored clock is
      // refreshed in a timer, not during render, and at once instead of in 30 s.
      const refresh = setTimeout(function readCurrentTime() {
        setClock({ target, now: readNow() });
      }, 0);

      // A moment that has already passed shows a closed window at once and needs
      // no ticker at all.
      if (target <= readNow()) {
        return function stopRefresh() {
          clearTimeout(refresh);
        };
      }

      const timer = setInterval(function tick() {
        const current = readNow();
        setClock({ target, now: current });
        // The window is over: stop waking the screen every 30 s.
        if (current >= target) clearInterval(timer);
      }, REFRESH_MS);

      return function stopFollowing() {
        clearTimeout(refresh);
        clearInterval(timer);
      };
    },
    [target],
  );

  // A clock read for another moment is not shown: until the refresh lands the
  // window reads as closed, never as a stale number of minutes.
  const now = clock.target === target ? clock.now : target;
  if (target === null || now === null || now >= target) return CLOSED;

  const remainingMs = target - now;
  return {
    remainingMs,
    minutes: Math.ceil(remainingMs / MINUTE_MS),
    open: true,
  };
}
