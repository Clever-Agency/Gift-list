import { useEffect, useRef } from "react";
import { BackHandler } from "react-native";
import { focusInLayer } from "./focus";

/**
 * Android «назад» closes the open layer instead of the screen or the app
 * (`DESIGN.md` → BottomSheet / Dialog). The listener lives only while the layer is
 * open and returns `true`, so with no layer the button works as before. When two
 * layers are open the last one registered answers first.
 */
export function useBackClose(open: boolean, onClose: () => void): void {
  const close = useRef(onClose);
  useEffect(function syncCloseHandler() {
    close.current = onClose;
  });

  useEffect(
    function listenForHardwareBack() {
      if (!open) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", function closeLayer() {
        close.current();
        return true;
      });
      return function stopListening() {
        subscription.remove();
      };
    },
    [open],
  );
}

/**
 * The phone has no DOM focus scope, and Android never reports a modal `onDismiss`,
 * so the `open` prop itself is the signal that the layer has gone.
 */
export function useNativeLayerClosed(open: boolean, onClosed?: () => void): void {
  const closed = useRef(onClosed);
  useEffect(function syncClosedHandler() {
    closed.current = onClosed;
  });

  const wasOpen = useRef(open);
  useEffect(
    function reportClose() {
      const was = wasOpen.current;
      wasOpen.current = open;
      if (open || !was) return;
      closed.current?.();
    },
    [open],
  );
}

export function useNativeFocusOnOpen(open: boolean, getNode: () => unknown): void {
  const read = useRef(getNode);
  useEffect(function syncNodeReader() {
    read.current = getNode;
  });

  useEffect(
    function focusOnOpen() {
      if (!open) return;
      focusInLayer(read.current() as object | null);
    },
    [open],
  );
}
