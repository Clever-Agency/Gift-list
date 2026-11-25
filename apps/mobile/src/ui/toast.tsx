import { Toast, useTabBarInset, type FocusTarget, type ToastTone } from "@gift-list/ui";
import { useEffect, useRef, useState, type RefObject } from "react";
import { AccessibilityInfo, Platform } from "react-native";
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
 *
 * В браузере диктор не спрашивается вовсе: `react-native-web` на
 * `isScreenReaderEnabled` всегда отвечает `true` (заглушка), и тост с действием
 * не скрывался бы никогда. Настоящий ответ есть только на телефоне.
 */
function screenReaderApi(): ScreenReaderApi | null {
  if (Platform.OS === "web") return null;
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
 * stops while the toast is hovered or a person set focus on one of its buttons, and
 * resumes with the remaining time. On a phone a toast with an action never hides
 * itself while a screen reader is on — the reader must reach the action first; the
 * web cannot tell (see `screenReaderApi`), so there the countdown runs. A screen that
 * knows the life of one toast itself passes `durationMs` (the undo toast of a closed
 * wish lives 10 s), and `actionRef` hands it the action button for the focus move.
 */
export function ToastHost({
  message,
  title,
  tone = "error",
  onDismiss,
  offsetBottom = 0,
  persistent,
  action,
  actionRef,
  durationMs,
  loading,
  dismissible,
}: {
  message: string;
  /** An optional title: the toast becomes a two-line card (title + description). */
  title?: string;
  tone?: ToastTone;
  onDismiss: () => void;
  /**
   * Height of a sticky bottom control the toast must not cover — the screen lifts
   * the toast above it (`DESIGN.md` → Toast: «над вкладками и над прилипшей кнопкой»).
   */
  offsetBottom?: number;
  /**
   * Keep the toast until it is dismissed, without a countdown. Defaults to `true`
   * for `error` — «Нет сети» stays — and to `false` for the other tones.
   */
  persistent?: boolean;
  /** Undo and retry (`DESIGN.md` → Toast: «необязательное действие»). */
  action?: { label: string; onPress: () => void };
  /**
   * The action button itself: the screen moves focus onto it when the toast
   * appears — after a wish is closed focus goes to «Отменить» in the toast
   * (`DESIGN.md` → «Куда уходит фокус», пункт «а»).
   */
  actionRef?: RefObject<FocusTarget | null>;
  /**
   * How long this toast lives, when the screen knows better than the text. The undo
   * toast of a closed wish lives 10 s (`DESIGN.md` → Toast: «undo toast ⌈10 с⌉»),
   * whatever its message length. Defaults to `toastDurationMs(message)`.
   */
  durationMs?: number;
  /** The action is running: a spinner instead of the tone icon, the card is busy. */
  loading?: boolean;
  /** Show the close button. Defaults to `true`. */
  dismissible?: boolean;
}) {
  const t = useTranslations("app.toast");
  /**
   * Story 6.2: the screen sits inside `AppShell`, and the bottom tabs take the
   * lower strip (56 px on compact and medium, 0 on expanded and outside the shell).
   * The toast stands above them, so its own offset grows by that height; on nested
   * screens the context is 0 and nothing moves.
   */
  const tabBarInset = useTabBarInset();
  const stays = persistent ?? tone === "error";
  const hasAction = action != null;

  const [screenReader, setScreenReader] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /**
   * Первый фокус на действии ставит сам экран: `DESIGN.md` → Доступность «Куда
   * уходит фокус», пункт «а» — после закрытия желания фокус уходит на «Отменить» в
   * тосте. Держать на таком фокусе паузу — значит не закрыть тост никогда, поэтому
   * отсчёт останавливает только следующий фокус, который поставил человек (Tab,
   * клик, возврат на кнопку). В браузере экран зовёт `focus()` и приходит событие
   * `onFocus`; на телефоне — `setAccessibilityFocus`, которое `onFocus` не шлёт,
   * так что там любой фокус на тосте человеческий.
   */
  const screenFocus = useRef(Platform.OS === "web" && hasAction && actionRef != null);
  /** Тост уже растворяется: следующий шаг — `onDismiss` и размонтирование. */
  const [leaving, setLeaving] = useState(false);
  const paused = hovered || focused;
  const autoHide = !stays && !(hasAction && screenReader);

  /**
   * Фокус человека на любом элементе тоста держит отсчёт; программный перевод
   * фокуса с экрана — нет.
   */
  function handleFocusChange(next: boolean, control: "action" | "close") {
    if (next && control === "action" && screenFocus.current) {
      screenFocus.current = false;
      return;
    }
    setFocused(next);
  }

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

  const duration = durationMs ?? toastDurationMs(message);
  /** Сколько осталось до скрытия: пауза вычитает прошедшее время из полного. */
  const remaining = useRef({ message, duration, ms: duration });
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
   * Новый тост — снова первый фокус на действии ставит экран (`action` у нового
   * тоста новый, поэтому закрытие второго желания подряд тоже перевооружает).
   */
  useEffect(
    function rearmScreenFocus() {
      screenFocus.current = Platform.OS === "web" && hasAction && actionRef != null;
    },
    [action, actionRef, duration, hasAction, message],
  );

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
    // Новый текст или новая длительность — новый тост: отсчёт начинается с его
    // собственной длительности.
    if (remaining.current.message !== message || remaining.current.duration !== duration) {
      remaining.current = { message, duration, ms: duration };
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
        duration,
        ms: Math.max(0, remaining.current.ms - (Date.now() - startedAt)),
      };
    };
  }, [autoHide, duration, message, paused]);

  return (
    <Toast
      testID="toast-host"
      message={message}
      title={title}
      tone={tone}
      closeLabel={t("close")}
      onClose={handleClose}
      action={action}
      actionRef={actionRef}
      loading={loading}
      dismissible={dismissible}
      offsetBottom={offsetBottom + tabBarInset}
      visible={!leaving}
      onHoverChange={setHovered}
      onFocusChange={handleFocusChange}
    />
  );
}

ToastHost.displayName = "ToastHost";
