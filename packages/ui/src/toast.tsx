import { View } from "@tamagui/core";
import { XStack } from "@tamagui/stacks";
import { Pressable } from "./pressable";
import { Text } from "./text";
import { spacing } from "./tokens";

export type ToastTone = "info" | "error";

export type ToastProps = {
  message: string;
  tone?: ToastTone;
  /** The close button's text and name, e.g. «Закрыть». */
  closeLabel: string;
  onClose: () => void;
  /** Undo and retry (`DESIGN.md` → Toast: «необязательное действие»). */
  action?: { label: string; onPress: () => void };
  /**
   * Height of a sticky bottom control the toast must not cover: the screen lifts
   * the toast above it (`DESIGN.md` → Toast: «над вкладками и над прилипшей кнопкой»).
   */
  offsetBottom?: number;
  /** The pointer is over the toast or left it; for pausing the countdown. */
  onHoverChange?: (hovered: boolean) => void;
  /** Focus entered or left one of the toast's buttons; for pausing the countdown. */
  onFocusChange?: (focused: boolean) => void;
  testID?: string;
};

/**
 * The look of a toast (`DESIGN.md` → components `toast`, `toast-error`): the host
 * decides when to show and hide it. An error is announced assertively
 * (`role="alert"`), an info toast politely (`role="status"`). The overlay lets
 * touches through; only the toast itself takes them.
 */
export function Toast({
  message,
  tone = "error",
  closeLabel,
  onClose,
  action,
  offsetBottom = 0,
  onHoverChange,
  onFocusChange,
  testID,
}: ToastProps) {
  const error = tone === "error";

  function handlePointerEnter() {
    onHoverChange?.(true);
  }

  function handlePointerLeave() {
    onHoverChange?.(false);
  }

  function handleFocus() {
    onFocusChange?.(true);
  }

  function handleBlur() {
    onFocusChange?.(false);
  }

  return (
    <View
      testID={testID}
      pointerEvents="box-none"
      position="absolute"
      left="$page-gutter"
      right="$page-gutter"
      bottom={spacing["page-gutter"] + offsetBottom}
      alignItems="center"
      zIndex="$toast"
    >
      <XStack
        role={error ? "alert" : "status"}
        aria-live={error ? "assertive" : "polite"}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        width="100%"
        maxWidth="$dialog-width"
        minHeight="$control-height"
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        borderRadius="$md"
        paddingHorizontal="$card-padding"
        paddingVertical="$2"
        backgroundColor={error ? "$destructive" : "$foreground"}
      >
        <Text
          kind="label"
          flexShrink={1}
          color={error ? "$destructive-foreground" : "$primary-foreground"}
        >
          {message}
        </Text>
        {action ? (
          <ToastButton
            label={action.label}
            onPress={action.onPress}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        ) : null}
        <ToastButton
          label={closeLabel}
          onPress={onClose}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </XStack>
    </View>
  );
}

Toast.displayName = "Toast";

type ToastButtonProps = {
  label: string;
  onPress: () => void;
  onFocus: () => void;
  onBlur: () => void;
};

function ToastButton({ label, onPress, onFocus, onBlur }: ToastButtonProps) {
  return (
    <Pressable
      aria-label={label}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      minHeight="$touch-target"
      minWidth="$touch-target"
      alignItems="center"
      justifyContent="center"
      // `ring-inverse` on the dark and red surfaces (`DESIGN.md` → toast.focus-ring).
      outlineColor="focus-visible:$ring-inverse"
    >
      <Text kind="button" color="$background" textDecorationLine="underline">
        {label}
      </Text>
    </Pressable>
  );
}

ToastButton.displayName = "ToastButton";
