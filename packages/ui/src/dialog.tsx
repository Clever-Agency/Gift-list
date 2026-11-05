import { XStack, YStack } from "@tamagui/stacks";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Dialog as TamaguiDialog } from "tamagui/dialog";
import { fontFor } from "./font-style";
import { focusInLayer, type FocusTarget } from "./focus";
import { useBackClose, useNativeFocusOnOpen, useNativeLayerClosed } from "./layer";
import { Pressable } from "./pressable";
import { SCRIM_OPACITY } from "./tokens";

export type DialogProps = {
  open: boolean;
  /** The question or the name of the layer. It is the dialog's accessible name. */
  title: string;
  /** One line under the title, e.g. what happens on confirm. */
  description?: string;
  /**
   * Esc, Android «назад», a scrim press and the close cross: the screen closes the
   * layer by setting `open` to `false`.
   */
  onClose: () => void;
  /**
   * The layer has really left the tree: the screen can put focus back on the control
   * it was opened from (`restoreFocus`). Without it the browser returns focus to the
   * element focused before opening.
   */
  onClosed?: () => void;
  /**
   * Where focus lands on opening: a ref to a control (the destructive confirm lands
   * on «Отмена», so Enter right after opening deletes nothing). Defaults to the title.
   */
  initialFocus?: RefObject<FocusTarget | null>;
  /** `alertdialog` for a destructive confirmation (WAI-ARIA APG). */
  role?: "dialog" | "alertdialog";
  /** A close cross at the end of the title row; the app draws the icon. */
  closeAction?: { label: string; icon: ReactNode };
  /** The body between the title and the actions. */
  children?: ReactNode;
  /** The buttons row, aligned to the end. */
  actions?: ReactNode;
  testID?: string;
};

/**
 * `DESIGN.md` → Dialog: a centered layer up to `dialog-width`, `surface`,
 * `rounded.lg`, over a `scrim` at 40%. Closes with Esc and a scrim press in the
 * browser and with the system «назад» on Android (only while it is open, so with no
 * layer the button works as before). Focus is trapped inside on the web.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  onClosed,
  initialFocus,
  role = "dialog",
  closeAction,
  children,
  actions,
  testID,
}: DialogProps) {
  const titleRef = useRef<FocusTarget>(null);
  const openRef = useRef(open);
  const closedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  openRef.current = open;
  useEffect(function clearClosedTimer() {
    return function stop() {
      clearTimeout(closedTimer.current);
    };
  }, []);

  useBackClose(open, onClose);
  useNativeLayerClosed(open, onClosed);
  useNativeFocusOnOpen(open, function readInitialFocus() {
    return (initialFocus ?? titleRef).current;
  });

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  function handleOpenAutoFocus(details: { cancel: () => void }) {
    // Focus goes inside as soon as the layer opens, onto the safe control.
    details.cancel();
    focusInLayer((initialFocus ?? titleRef).current);
  }

  function handleCloseAutoFocus(details: { cancel: () => void }) {
    // The screen puts focus back itself, once the layer has left the tree: the
    // callback runs inside the unmount, so the move waits for the next task.
    if (!onClosed) return;
    details.cancel();
    clearTimeout(closedTimer.current);
    closedTimer.current = setTimeout(function reportClosed() {
      // Opened again within the same task: focus belongs to the new layer.
      if (openRef.current) return;
      onClosed();
    }, 0);
  }

  return (
    <TamaguiDialog modal open={open} onOpenChange={handleOpenChange}>
      <TamaguiDialog.Portal paddingHorizontal="$page-gutter">
        <TamaguiDialog.Overlay
          key="overlay"
          testID={testID ? `${testID}-scrim` : undefined}
          backgroundColor="$scrim"
          opacity={SCRIM_OPACITY}
        />
        <TamaguiDialog.Content
          key="content"
          role={role}
          testID={testID}
          width="100%"
          maxWidth="$dialog-width"
          backgroundColor="$surface"
          borderRadius="$lg"
          borderWidth={0}
          padding="$card-padding"
          gap="$grid-gap"
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <XStack alignItems="flex-start" gap="$2">
            <YStack flex={1} gap="$1">
              <TamaguiDialog.Title
                ref={titleRef as never}
                tabIndex={-1}
                {...fontFor("heading")}
                fontSize="$heading"
                lineHeight="$heading"
                color="$foreground"
                outlineWidth={0}
              >
                {title}
              </TamaguiDialog.Title>
              {description ? (
                <TamaguiDialog.Description
                  {...fontFor("body")}
                  fontSize="$body"
                  lineHeight="$body"
                  color="$muted-foreground"
                >
                  {description}
                </TamaguiDialog.Description>
              ) : null}
            </YStack>
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
            <XStack
              alignItems="center"
              justifyContent="flex-end"
              flexWrap="wrap"
              gap="$2"
            >
              {actions}
            </XStack>
          ) : null}
        </TamaguiDialog.Content>
      </TamaguiDialog.Portal>
    </TamaguiDialog>
  );
}

Dialog.displayName = "Dialog";
