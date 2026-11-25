import { isWeb, useMedia } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Dialog as TamaguiDialog } from "tamagui/dialog";
import { Sheet } from "tamagui/sheet";
import { fontFor } from "./font-style";
import { focusInLayer, type FocusTarget } from "./focus";
import { useBackClose, useNativeFocusOnOpen, useNativeLayerClosed } from "./layer";
import { layerExitMs, layerFade, sheetMotion } from "./motion";
import { Pressable } from "./pressable";
import { ScrollView } from "./scroll";
import { Text } from "./text";
import { SCRIM_OPACITY } from "./tokens";
import { useReduceMotion } from "./use-reduce";

/** Which layer the screens see: the centred window or the bottom sheet. */
export type LayerPresentation = "dialog" | "sheet";

/**
 * The contract both layers share (CLE-125). `DESIGN.md` → BottomSheet / Dialog keeps
 * the two views apart, so `presentation` picks one of two separate paints; it never
 * mixes them. `description`, `role` and `layout` belong to the window only.
 */
export type LayerFrameProps = {
  presentation: LayerPresentation;
  open: boolean;
  title: string;
  onClose: () => void;
  onClosed?: () => void;
  initialFocus?: RefObject<FocusTarget | null>;
  closeAction?: { label: string; icon: ReactNode };
  children?: ReactNode;
  actions?: ReactNode;
  testID?: string;
  /** The window presentation only: one line under the title. */
  description?: string;
  /** The window presentation only: `alertdialog` for a destructive confirmation. */
  role?: "dialog" | "alertdialog";
  /** The window presentation only: `default` confirm width or the wish-detail width. */
  layout?: "default" | "detail";
};

type DialogFrameProps = Omit<LayerFrameProps, "presentation">;
type SheetFrameProps = Omit<LayerFrameProps, "presentation" | "description" | "role" | "layout">;

/**
 * The one entry point of both layers: a screen names the presentation and passes the
 * shared slots. The window and the sheet stay two paints of the same contract, so a
 * screen never depends on which Tamagui primitive is behind it.
 */
export function LayerFrame({ presentation, ...props }: LayerFrameProps) {
  if (presentation === "sheet") {
    return (
      <SheetFrame
        open={props.open}
        title={props.title}
        onClose={props.onClose}
        onClosed={props.onClosed}
        initialFocus={props.initialFocus}
        closeAction={props.closeAction}
        actions={props.actions}
        testID={props.testID}
      >
        {props.children}
      </SheetFrame>
    );
  }
  return <DialogFrame {...props} />;
}

LayerFrame.displayName = "LayerFrame";

/**
 * The centred window exactly as `Dialog` painted it before CLE-125: `surface`,
 * `rounded.lg`, fade only (no shift), Esc, scrim, «назад» and the cross, focus inside.
 */
function DialogFrame({
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
  layout = "default",
  testID,
}: DialogFrameProps) {
  const media = useMedia();
  const detail = layout === "detail";
  const compact = detail && !media.medium;
  const titleRef = useRef<FocusTarget>(null);
  const openRef = useRef(open);
  const closedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduce = useReduceMotion();
  const motion = layerFade(reduce);
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
    // callback runs inside the unmount, so the move waits for the exit fade
    // (`quick` 160 ms, 100 ms with reduce) to finish and only then reports.
    if (!onClosed) return;
    details.cancel();
    clearTimeout(closedTimer.current);
    closedTimer.current = setTimeout(function reportClosed() {
      // Opened again within the same task: focus belongs to the new layer.
      if (openRef.current) return;
      onClosed();
    }, layerExitMs(reduce));
  }

  return (
    <TamaguiDialog modal open={open} onOpenChange={handleOpenChange}>
      <TamaguiDialog.Portal
        paddingHorizontal={compact ? "$2" : "$page-gutter"}
        paddingVertical={compact ? "$2" : undefined}
      >
        <TamaguiDialog.Overlay
          key="overlay"
          testID={testID ? `${testID}-scrim` : undefined}
          backgroundColor="$scrim"
          opacity={{ default: SCRIM_OPACITY, enter: 0, exit: 0 }}
          transition={motion}
        />
        <TamaguiDialog.Content
          key="content"
          role={role}
          testID={testID}
          width="100%"
          maxWidth={detail ? (compact ? "100%" : "$detail-width") : "$dialog-width"}
          maxHeight={detail ? (compact ? "100%" : "85%") : undefined}
          height={compact ? "100%" : undefined}
          overflow={detail ? "hidden" : undefined}
          backgroundColor="$surface"
          borderRadius={compact ? "$md" : "$lg"}
          borderWidth={0}
          padding="$card-padding"
          gap="$grid-gap"
          shadowColor="$scrim"
          shadowOpacity={0.18}
          shadowRadius={24}
          shadowOffset={{ width: 0, height: 12 }}
          opacity={{ default: 1, enter: 0, exit: 0 }}
          transition={motion}
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
                borderRadius="$md"
              >
                {closeAction.icon}
              </Pressable>
            ) : null}
          </XStack>
          {detail ? (
            <ScrollView
              testID={testID ? `${testID}-scroll` : "dialog-scroll"}
              maxHeight={compact ? "85vh" : "70vh"}
              flexShrink={1}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
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

DialogFrame.displayName = "DialogFrame";

/**
 * The bottom sheet exactly as `BottomSheet` painted it before CLE-125: from the
 * bottom, `surface-raised`, `rounded.xl` on top, the handle, the rise (`sheetMotion`),
 * a drag down, Esc, scrim, «назад» and the cross, focus inside.
 */
function SheetFrame({
  open,
  title,
  onClose,
  onClosed,
  initialFocus,
  closeAction,
  children,
  actions,
  testID,
}: SheetFrameProps) {
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
          // v8: a sheet is the raised layer; in the dark theme its tone and the
          // highlight do the work, the shadow only softens the edge.
          backgroundColor="$surface-raised"
          borderTopLeftRadius="$xl"
          borderTopRightRadius="$xl"
          shadowColor="$scrim"
          shadowOpacity={0.18}
          shadowRadius={24}
          shadowOffset={{ width: 0, height: -12 }}
        />
        <YStack padding="$card-padding" gap="$grid-gap">
          <XStack alignItems="flex-start" gap="$2">
            {/* `minWidth={0}`: the row hands the free space to the heading, and
                without it a long unbreakable title (a gift name, a URL) holds the
                row at its min-content width and pushes the cross off the sheet. */}
            <Text
              ref={titleRef as never}
              id={titleId}
              kind="heading"
              role="heading"
              aria-level={2}
              tabIndex={-1}
              flex={1}
              minWidth={0}
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
                borderRadius="$md"
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

SheetFrame.displayName = "SheetFrame";
