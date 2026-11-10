import { isWeb } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { Sheet } from "tamagui/sheet";
import { focusInLayer, type FocusTarget } from "./focus";
import { useBackClose, useNativeFocusOnOpen, useNativeLayerClosed } from "./layer";
import { layerFade, sheetMotion } from "./motion";
import { Pressable } from "./pressable";
import { Text } from "./text";
import { SCRIM_OPACITY } from "./tokens";
import { useReduceMotion } from "./use-reduce";

export type BottomSheetProps = {
  open: boolean;
  /** The name of the layer; also its visible heading. */
  title: string;
  /** Esc, Android «назад», a scrim press, a drag down and the close cross. */
  onClose: () => void;
  /**
   * The layer has left the tree: the screen can put focus back on the control it was
   * opened from (`restoreFocus`).
   */
  onClosed?: () => void;
  /** Where focus lands on opening. Defaults to the heading. */
  initialFocus?: RefObject<FocusTarget | null>;
  /** A close cross at the end of the heading row; the app draws the icon. */
  closeAction?: { label: string; icon: ReactNode };
  children?: ReactNode;
  /** The buttons row, aligned to the end. */
  actions?: ReactNode;
  testID?: string;
};

/**
 * `DESIGN.md` → BottomSheet: from the bottom, `surface`, `rounded.xl` on top, over a
 * `scrim` at 40%, as high as its content. Closes with Esc and a scrim press in the
 * browser and with the system «назад» on Android (only while open). The browser keeps
 * focus inside the sheet while it is open.
 *
 * `DESIGN.md` → Движение: the sheet rises and the scrim fades with `quick` (160 ms)
 * on both runtimes. With «уменьшить движение» the position jumps (`instant`) and the
 * scrim only fades, for 100 ms.
 */
export function BottomSheet({
  open,
  title,
  onClose,
  onClosed,
  initialFocus,
  closeAction,
  children,
  actions,
  testID,
}: BottomSheetProps) {
  const titleId = useId();
  const titleRef = useRef<FocusTarget>(null);
  const reduce = useReduceMotion();
  const scrimMotion = layerFade(reduce);

  useBackClose(open, onClose);
  useNativeLayerClosed(open, onClosed);
  useNativeFocusOnOpen(open, function readInitialFocus() {
    return (initialFocus ?? titleRef).current;
  });

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  function handleTransition(event: { phase: string; cause: string; finished?: boolean }) {
    // The phone reports the close through `open` (`useNativeLayerClosed`).
    if (!isWeb || event.phase !== "end") return;
    if (event.cause === "close" && event.finished !== false) {
      // Tamagui's focus scope has put focus back to where the sheet was opened from;
      // the screen may still want to move it onto its own control.
      onClosed?.();
    }
    if (event.cause === "open") {
      focusInLayer((initialFocus ?? titleRef).current);
    }
  }

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={handleOpenChange}
      onTransition={handleTransition}
      snapPointsMode="fit"
      dismissOnSnapToBottom
      dismissOnOverlayPress
      aria-labelledby={titleId}
      transition={sheetMotion(reduce)}
    >
      <Sheet.Overlay
        testID={testID ? `${testID}-scrim` : undefined}
        backgroundColor="$scrim"
        opacity={{ default: SCRIM_OPACITY, enter: 0, exit: 0 }}
        transition={scrimMotion}
      />
      <Sheet.Handle backgroundColor="$border-strong" />
      <Sheet.Container testID={testID}>
        <Sheet.Background
          backgroundColor="$surface"
          borderTopLeftRadius="$xl"
          borderTopRightRadius="$xl"
        />
        <YStack padding="$card-padding" gap="$grid-gap">
          <XStack alignItems="flex-start" gap="$2">
            <Text
              ref={titleRef as never}
              id={titleId}
              kind="heading"
              role="heading"
              aria-level={2}
              tabIndex={-1}
              flex={1}
              outlineWidth={0}
            >
              {title}
            </Text>
            {closeAction ? (
              <Pressable
                aria-label={closeAction.label}
                onPress={onClose}
                width="$touch-target"
                height="$touch-target"
                alignItems="center"
                justifyContent="center"
                borderRadius="$full"
              >
                {closeAction.icon}
              </Pressable>
            ) : null}
          </XStack>
          {children}
          {actions ? (
            <XStack alignItems="center" justifyContent="flex-end" flexWrap="wrap" gap="$2">
              {actions}
            </XStack>
          ) : null}
        </YStack>
      </Sheet.Container>
    </Sheet>
  );
}

BottomSheet.displayName = "BottomSheet";
