import { Toast } from "@gift-list/ui";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useTranslations } from "use-intl";

/**
 * Сколько тост живёт сам. `DESIGN.md` → Toast задаёт `max(4 с, 1 с + 60 мс ×
 * символ)`; по решению владельца обычный тост исчезает ровно на 1 с раньше
 * (`max(3000, 60 × символ)`), поэтому прежние 4 с и «1 с» из формулы списаны на
 * ту же секунду. Floor остаётся: короткое подтверждение не должно мигать.
 */
export const TOAST_MIN_MS = 3000;
/** Время на символ: длинное сообщение успевают прочитать. */
export const TOAST_MS_PER_CHAR = 60;
/**
 * Уход тоста (`quick` 160 мс, `DESIGN.md` → Движение): хост начинает fade за
 * столько до конца отсчёта, чтобы к `onDismiss` тост уже растворился.
 */
export const TOAST_FADE_MS = 160;

export function toastDurationMs(message: string): number {
  return Math.max(TOAST_MIN_MS, TOAST_MS_PER_CHAR * message.length);
}

type ScreenReaderApi = {
  isScreenReaderEnabled?: () => Promise<boolean>;
  addEventListener?: (
    event: "screenReaderChanged",
    listener: (enabled: boolean) => void,
  ) => { remove: () => void };
};

/**
 * `AccessibilityInfo` есть не на каждой платформе, и частичные моки `react-native`
 * в тестах его не отдают. Без него тост с действием просто ведёт себя как обычный.
 */
function screenReaderApi(): ScreenReaderApi | null {
  try {
    return (AccessibilityInfo as ScreenReaderApi | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * One toast at a time (`DESIGN.md` → Toast, ToastHost). An error is announced
 * assertively and stays until it is dismissed: «Нет сети» never hides itself.
 *
 * An info toast hides itself after `toastDurationMs(message)`, but the countdown
 * stops while the toast is hovered or one of its buttons has focus and resumes
 * with the remaining time. A toast with an action never hides itself while a
 * screen reader is on — the reader must reach the action first.
 */
export function ToastHost({
  message,
  tone = "error",
  onDismiss,
  offsetBottom = 0,
  persistent,
  action,
}: {
  message: string;
  tone?: "info" | "error";
  onDismiss: () => void;
  /**
   * Height of a sticky bottom control the toast must not cover — the screen lifts
   * the toast above it (`DESIGN.md` → Toast: «над вкладками и над прилипшей кнопкой»).
   */
  offsetBottom?: number;
  /**
   * Keep the toast until it is dismissed, without a countdown. Defaults to `true`
   * for `error` — «Нет сети» stays — and to `false` for `info`.
   */
  persistent?: boolean;
  /** Undo and retry (`DESIGN.md` → Toast: «необязательное действие»). */
  action?: { label: string; onPress: () => void };
}) {
  const t = useTranslations("app.toast");
  const stays = persistent ?? tone === "error";
  const hasAction = action != null;

  const [screenReader, setScreenReader] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /** Тост уже растворяется: следующий шаг — `onDismiss` и размонтирование. */
  const [leaving, setLeaving] = useState(false);
  const paused = hovered || focused;
  const autoHide = !stays && !(hasAction && screenReader);

  useEffect(function detectScreenReader() {
    // Диктор важен только тосту с действием: без действия тост ничего не прячет.
    if (!hasAction) return;
    const api = screenReaderApi();
    if (!api?.isScreenReaderEnabled) return;

    let live = true;
    api
      .isScreenReaderEnabled()
      .then(function applyScreenReaderState(enabled) {
        if (live) setScreenReader(enabled);
      })
      .catch(function ignoreScreenReaderError() {
        // Не знаем — считаем, что диктор выключен: тост с действием тогда скроется.
      });
    const subscription = api.addEventListener?.(
      "screenReaderChanged",
      function applyScreenReaderChange(enabled) {
        if (live) setScreenReader(enabled);
      },
    );
    return function stopScreenReaderSync() {
      live = false;
      subscription?.remove();
    };
  }, [hasAction]);

  const duration = toastDurationMs(message);
  /** Сколько осталось до скрытия: пауза вычитает прошедшее время из полного. */
  const remaining = useRef({ message, ms: duration });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useRef(onDismiss);
  /** `onDismiss` уже заказан: отсчёт и кнопка не просят его второй раз. */
  const closing = useRef(false);
  /** Крестик закрыл тост: даём fade доиграть и только потом убираем слой. */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(function syncDismissHandler() {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(function clearCloseTimerOnUnmount() {
    return function stop() {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    };
  }, []);

  /**
   * Крестик — действие человека, а не конец отсчёта: `onDismiss` ждёт fade,
   * чтобы тост ушёл плавно. Само появление/уход рисует `Toast`.
   */
  function handleClose() {
    if (closing.current) return;
    closing.current = true;
    setLeaving(true);
    closeTimer.current = setTimeout(function finishClose() {
      closeTimer.current = null;
      dismiss.current();
    }, TOAST_FADE_MS);
  }

  useEffect(function runCountdown() {
    // Новый текст — новый тост: отсчёт начинается с его собственной длительности.
    if (remaining.current.message !== message) {
      remaining.current = { message, ms: duration };
      closing.current = false;
      if (closeTimer.current !== null) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      setLeaving(false);
    }
    if (!autoHide || paused || closing.current) {
      // Пауза возвращает тост, если fade уже начался; закрытый крестиком не
      // воскрешаем — его убирает `closeTimer`.
      if (!closing.current) setLeaving(false);
      return;
    }

    const startedAt = Date.now();
    // Fade стартует за `TOAST_FADE_MS` до дедлайна, поэтому к вызову
    // `onDismiss` слой уже прозрачен; сам дедлайн и `onDismiss` не сдвигаются.
    const fadeIn = Math.max(0, remaining.current.ms - TOAST_FADE_MS);
    const fadeTimer = setTimeout(function fadeOut() {
      setLeaving(true);
    }, fadeIn);
    timer.current = setTimeout(function hideToast() {
      timer.current = null;
      setLeaving(true);
      if (closing.current) return;
      closing.current = true;
      dismiss.current();
    }, remaining.current.ms);

    return function pauseCountdown() {
      clearTimeout(fadeTimer);
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      remaining.current = {
        message,
        ms: Math.max(0, remaining.current.ms - (Date.now() - startedAt)),
      };
    };
  }, [autoHide, duration, message, paused]);

  return (
    <Toast
      testID="toast-host"
      message={message}
      tone={tone}
      closeLabel={t("close")}
      onClose={handleClose}
      action={action}
      offsetBottom={offsetBottom}
      visible={!leaving}
      onHoverChange={setHovered}
      onFocusChange={setFocused}
    />
  );
}

ToastHost.displayName = "ToastHost";
