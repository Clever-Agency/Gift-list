import type { KeyboardEvent } from "react";

/**
 * A `div role="button"` does not react to the keyboard by itself, unlike a real
 * `<button>`: Enter and Space run the press (a link: Enter only, as a real `<a>`).
 * A held key does not repeat the press. On the phone `onKeyDown` is never fired,
 * so the handler is harmless there.
 */
export function pressOnKeyDown(onPress: (() => void) | undefined, role?: string) {
  return function handleKeyDown(event: KeyboardEvent) {
    if (!onPress) return;
    const isLink = role === "link";
    if (event.key !== "Enter" && (isLink || event.key !== " ")) return;
    event.preventDefault();
    if (event.repeat) return;
    onPress();
  };
}
