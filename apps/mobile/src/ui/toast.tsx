import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";

/**
 * Сколько тост живёт сам (`DESIGN.md` → Toast: «обычный — `max(4 с, 1 с + 60 мс ×
 * символ)`»): короткое сообщение читается за четыре секунды, длинное получает
 * время на каждый символ.
 */
export function toastDurationMs(message: string): number {
  return Math.max(4000, 1000 + 60 * message.length);
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
  const palette = tone === "error" ? styles.error : styles.info;
  const stays = persistent ?? tone === "error";
  const hasAction = action != null;

  const [screenReader, setScreenReader] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const autoHide = !stays && !(hasAction && screenReader);

  useEffect(() => {
    // Диктор важен только тосту с действием: без действия тост ничего не прячет.
    if (!hasAction) return;
    const api = screenReaderApi();
    if (!api?.isScreenReaderEnabled) return;

    let live = true;
    api
      .isScreenReaderEnabled()
      .then((enabled) => {
        if (live) setScreenReader(enabled);
      })
      .catch(() => {
        // Не знаем — считаем, что диктор выключен: тост с действием тогда скроется.
      });
    const subscription = api.addEventListener?.("screenReaderChanged", (enabled) => {
      if (live) setScreenReader(enabled);
    });
    return () => {
      live = false;
      subscription?.remove();
    };
  }, [hasAction]);

  const duration = toastDurationMs(message);
  /** Сколько осталось до скрытия: пауза вычитает прошедшее время из полного. */
  const remaining = useRef({ message, ms: duration });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useRef(onDismiss);

  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    // Новый текст — новый тост: отсчёт начинается с его собственной длительности.
    if (remaining.current.message !== message) {
      remaining.current = { message, ms: duration };
    }
    if (!autoHide || paused) return;

    const startedAt = Date.now();
    timer.current = setTimeout(() => {
      timer.current = null;
      dismiss.current();
    }, remaining.current.ms);

    return () => {
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
    // `box-none` is a View prop, not a style key: the overlay lets touches through to
    // the screen, the toast inside stays tappable. In a style object it is ignored.
    <View
      testID="toast-host"
      pointerEvents="box-none"
      style={[styles.host, { bottom: spacing["grid-gap"] + offsetBottom }]}
    >
      <View
        // React Native has no `status` accessibility role, but `role` maps to the
        // ARIA role on the web (iPhone and Android keep the live region).
        role={tone === "error" ? "alert" : "status"}
        accessibilityRole={tone === "error" ? "alert" : undefined}
        accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
        // `onHoverIn` живёт только на Pressable, а Pressable вокруг кнопок ломает
        // порядок целей; в react-native-web указательные события пробрасываются и
        // на View, ими и ловим hover мыши.
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        style={[styles.toast, palette]}
      >
        <Text style={[styles.message, tone === "error" ? styles.errorText : styles.infoText]}>
          {message}
        </Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={({ pressed }) => [styles.dismiss, pressed ? styles.pressed : null]}
          >
            <Text style={styles.dismissLabel}>{action.label}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={onDismiss}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={({ pressed }) => [styles.dismiss, pressed ? styles.pressed : null]}
        >
          <Text style={styles.dismissLabel}>{t("close")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing["page-gutter"],
    right: spacing["page-gutter"],
    alignItems: "center",
  },
  toast: {
    width: "100%",
    maxWidth: spacing["dialog-width"],
    minHeight: spacing["control-height"],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing["grid-gap"] / 2,
    borderRadius: rounded.md,
    paddingHorizontal: spacing["card-padding"],
    paddingVertical: spacing["grid-gap"] / 2,
  },
  info: {
    backgroundColor: colors.foreground,
  },
  error: {
    backgroundColor: colors.destructive,
  },
  message: {
    flexShrink: 1,
    ...textStyle("label"),
  },
  errorText: {
    color: colors["destructive-foreground"],
  },
  infoText: {
    color: colors["primary-foreground"],
  },
  dismiss: {
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.9,
  },
  dismissLabel: {
    ...textStyle("button"),
    color: colors.background,
    textDecorationLine: "underline",
  },
});
