import { router } from "expo-router";

/**
 * The part of a browser click that decides «navigate here or let the browser
 * do it»: a React `MouseEvent` fits this shape, and so does a plain object in a
 * test. `currentTarget` is the anchor the handler is attached to.
 */
export type LinkPressEvent = {
  defaultPrevented?: boolean;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  currentTarget?: { target?: string } | null;
  preventDefault?: () => void;
};

/**
 * The click rule of expo-router for a real `<a href>` (`shouldHandleMouseEvent`,
 * which the package does not export from its root): only a plain left click
 * without Ctrl/Cmd/Shift/Alt and without a `target` is handled inside the app.
 * Everything else — middle button, modified click, «открыть в новой вкладке» —
 * keeps the browser default, and an already prevented click is left alone.
 */
export function shouldNavigateInApp(event?: LinkPressEvent | null): boolean {
  if (!event || event.defaultPrevented) return false;
  if (event.button !== undefined && event.button !== null && event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const target = event.currentTarget?.target;
  return target === undefined || target === null || target === "" || target === "self";
}

/**
 * The `onPress` of a web link of the app: a plain left click goes through the
 * router without reloading the SPA (`DESIGN.md` → Навигация приложения); the
 * `href` stays on the anchor for the keyboard, the screen reader and the new
 * tab. The phone keeps its own `onPress` with `router.navigate`.
 */
export function pressLink(href: string): (event?: unknown) => void {
  return function handleLinkPress(event?: unknown) {
    const click = event as LinkPressEvent | undefined;
    if (!shouldNavigateInApp(click)) return;
    click?.preventDefault?.();
    router.navigate(href);
  };
}
