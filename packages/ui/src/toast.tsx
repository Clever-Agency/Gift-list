import { View } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import type { RefObject } from "react";
import type { FocusTarget } from "./focus";
import { AlertTriangle, CheckCircle, CircleAlert, Close, Info } from "./icons";
import { layerFade } from "./motion";
import { Pressable } from "./pressable";
import { Spinner } from "./spinner";
import { Text } from "./text";
import { useThemeColor } from "./theme-color";
import { spacing, type ColorToken } from "./tokens";
import { useReduceMotion } from "./use-reduce";

export type ToastTone = "info" | "success" | "warning" | "error";

/** The glyph of each tone: shape as well as colour, so the meaning is never colour alone. */
const TONE_ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: CircleAlert,
} as const;

/** The calm v8 ink of each tone (`DESIGN.md` → Colors: info, success, warning, destructive). */
const TONE_INK = {
  info: "primary",
  success: "success",
  warning: "warning",
  error: "destructive",
} as const satisfies Record<ToastTone, ColorToken>;

export type ToastProps = {
  /** The line of the toast; with `title` it becomes the description under it. */
  message: string;
  /** An optional title: the toast then becomes a two-line card. */
  title?: string;
  /** `info` (default), `success`, `warning` or `error`. */
  tone?: ToastTone;
  /** The close button's accessible name, e.g. «Закрыть». */
  closeLabel: string;
  onClose: () => void;
  /**
   * The action of the toast (undo, retry). It is a text button under the message, so a
   * long action label wraps with the text instead of squeezing it.
   */
  action?: { label: string; onPress: () => void };
  /**
   * The action button itself, so the screen can move focus onto it after the
   * action that raised the toast (`DESIGN.md` → «Куда уходит фокус»: после
   * закрытия желания фокус уходит на «Отменить» в тосте). The ref is `null`
   * when there is no `action`.
   */
  actionRef?: RefObject<FocusTarget | null>;
  /** The action is running: a spinner replaces the tone icon and the card is announced busy. */
  loading?: boolean;
  /** Show the close button. Defaults to `true`; a blocking toast can hide it. */
  dismissible?: boolean;
  /**
   * Height of a sticky bottom control the toast must not cover: the screen lifts
   * the toast above it (`DESIGN.md` → Toast: «над вкладками и над прилипшей кнопкой»).
   */
  offsetBottom?: number;
  /** The pointer is over the toast or left it; for pausing the countdown. */
  onHoverChange?: (hovered: boolean) => void;
  /**
   * Focus entered or left one of the toast's controls; for pausing the countdown.
   * The `control` says which one: the host needs it to tell the focus the screen
   * moved onto `action` (`actionRef`) from the focus a person set with Tab or a click.
   */
  onFocusChange?: (focused: boolean, control: "action" | "close") => void;
  /**
   * The host is taking the toast away: the toast fades out and stops taking
   * touches. The host unmounts it when the fade is over.
   */
  visible?: boolean;
  testID?: string;
};

/**
 * The look of a toast (`DESIGN.md` → components `toast`, `toast-error`): the host
 * decides when to show and hide it. The card is `surface` with radius 16, a 1 px
 * frame and the card elevation (the dark theme takes its highlight from the theme);
 * the tone is carried by a small icon and its calm ink, the text stays neutral, so
 * every pair keeps AA contrast. `error` and `warning` are announced assertively
 * (`role="alert"`), `info` and `success` politely (`role="status"`). The overlay lets
 * touches through; only the toast itself takes them. `actionRef` hands the action
 * button to the screen, which moves focus onto it when the toast appears
 * (`DESIGN.md` → «Куда уходит фокус», пункт «а»).
 *
 * `DESIGN.md` → Движение: it fades in with `quick` (160 ms) and fades out the same
 * way; with «уменьшить движение» both fades last 100 ms, with no shift.
 */
export function Toast({
  message,
  title,
  tone = "error",
  closeLabel,
  onClose,
  action,
  actionRef,
  loading = false,
  dismissible = true,
  offsetBottom = 0,
  onHoverChange,
  onFocusChange,
  visible = true,
  testID,
}: ToastProps) {
  const assertive = tone === "error" || tone === "warning";
  const ink = useThemeColor(TONE_INK[tone]);
  const closeInk = useThemeColor("muted-foreground");
  const Icon = TONE_ICONS[tone];
  const reduce = useReduceMotion();

  function handlePointerEnter() {
    onHoverChange?.(true);
  }

  function handlePointerLeave() {
    onHoverChange?.(false);
  }

  function handleActionFocus() {
    onFocusChange?.(true, "action");
  }

  function handleActionBlur() {
    onFocusChange?.(false, "action");
  }

  function handleCloseFocus() {
    onFocusChange?.(true, "close");
  }

  function handleCloseBlur() {
    onFocusChange?.(false, "close");
  }

  return (
    <View
      testID={testID}
      pointerEvents={visible ? "box-none" : "none"}
      position="absolute"
      left="$page-gutter"
      right="$page-gutter"
      bottom={spacing["page-gutter"] + offsetBottom}
      alignItems="center"
      zIndex="$toast"
      opacity={{ default: visible ? 1 : 0, enter: 0 }}
      transition={layerFade(reduce)}
    >
      <XStack
        role={assertive ? "alert" : "status"}
        aria-live={assertive ? "assertive" : "polite"}
        aria-busy={loading || undefined}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        width="100%"
        maxWidth="$dialog-width"
        alignItems="flex-start"
        gap="$2"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        paddingHorizontal="$card-padding"
        paddingVertical="$3"
        backgroundColor="$surface"
        boxShadow="$shadow-card"
      >
        <View
          width="$icon-inline"
          height="$icon-inline"
          marginTop={2}
          flexShrink={0}
          alignItems="center"
          justifyContent="center"
        >
          {loading ? (
            <Spinner size={spacing["icon-inline"]} color={ink} />
          ) : (
            <Icon size={spacing["icon-inline"]} color={ink} testID={testID ? `${testID}-icon` : undefined} />
          )}
        </View>
        <YStack flex={1} minWidth={0} gap="$1">
          {title ? <Text kind="body-strong">{title}</Text> : null}
          <Text kind="label" tone={title ? "muted" : "default"} flexShrink={1}>
            {message}
          </Text>
          {action ? (
            <Pressable
              ref={actionRef as never}
              role="button"
              aria-label={action.label}
              onPress={action.onPress}
              onFocus={handleActionFocus}
              onBlur={handleActionBlur}
              alignSelf="flex-start"
              minHeight="$touch-target"
              justifyContent="center"
            >
              <Text kind="button" color="$primary" textDecorationLine="underline">
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </YStack>
        {dismissible ? (
          <Pressable
            aria-label={closeLabel}
            onPress={onClose}
            onFocus={handleCloseFocus}
            onBlur={handleCloseBlur}
            minHeight="$touch-target"
            minWidth="$touch-target"
            alignItems="center"
            justifyContent="center"
          >
            <Close size={spacing["icon-small"]} color={closeInk} />
          </Pressable>
        ) : null}
      </XStack>
    </View>
  );
}

Toast.displayName = "Toast";
