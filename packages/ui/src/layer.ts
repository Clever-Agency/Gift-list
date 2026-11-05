/**
 * Web side of the layer helpers. In the browser Tamagui's `Dialog` already owns
 * Esc, the focus trap and the return of focus (`onCloseAutoFocus`), so these are
 * no-ops; `layer.native.ts` replaces them on Android and iOS, where the system
 * back button and the accessibility focus need explicit code.
 */

/** Android «назад» closes the open layer (native only). */
export function useBackClose(open: boolean, onClose: () => void): void {
  void open;
  void onClose;
}

/** Reports that the layer has closed, where no focus scope can (native only). */
export function useNativeLayerClosed(open: boolean, onClosed?: () => void): void {
  void open;
  void onClosed;
}

/** Moves the screen reader to a node when the layer opens (native only). */
export function useNativeFocusOnOpen(open: boolean, getNode: () => unknown): void {
  void open;
  void getNode;
}
