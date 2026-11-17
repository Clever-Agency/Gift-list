import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * The catalog stands this in for `expo-router`: the app routes are not mounted
 * inside Storybook, so the navigator, the screen options and the imperative
 * router do nothing. `Link` still renders a real `<a>` (via `asChild` it hands
 * the href and the click handler to the child), because hover and focus of a
 * link are CSS states the catalog must show as they are.
 */

type HrefLike = string | { pathname?: string; params?: Record<string, string> };

type LinkProps = {
  href: HrefLike;
  asChild?: boolean;
  onPress?: () => void;
  children?: ReactNode;
};

function hrefOf(href: HrefLike): string | undefined {
  return typeof href === "string" ? href : href?.pathname;
}

function navigate(event: { preventDefault?: () => void } | undefined) {
  // The catalog has no app routes: the click only proves the link is real.
  event?.preventDefault?.();
}

export function Link({ href, asChild, onPress, children }: LinkProps) {
  const url = hrefOf(href);

  function handleClick(event: { preventDefault?: () => void }) {
    navigate(event);
    onPress?.();
  }

  if (asChild && isValidElement(children)) {
    // `asChild` gives the child the anchor props, exactly like expo-router does.
    return cloneElement(children as ReactElement<{ href?: string; onClick?: unknown }>, {
      href: url,
      onClick: handleClick,
    });
  }

  return (
    <a href={url} onClick={handleClick}>
      {children}
    </a>
  );
}

Link.displayName = "Link";

/** `<Stack.Screen options={…}>` only sets the native header; nothing to draw here. */
export function Screen(): null {
  return null;
}

export function Stack({ children }: { children?: ReactNode }): ReactNode {
  return children ?? null;
}

Stack.Screen = Screen;
Stack.displayName = "Stack";

const routes = {
  push() {},
  replace() {},
  back() {},
  navigate() {},
  dismissTo() {},
  setParams() {},
  canGoBack() {
    return false;
  },
};

/** What `useRouter()` / `router` answer in the catalog: every call is a no-op. */
export const router = routes;

export function useRouter() {
  return routes;
}

/** The catalog has one page; a link is shown, not followed. */
export function usePathname() {
  return "/";
}

export function useSegments(): string[] {
  return [];
}

export function useLocalSearchParams(): Record<string, string> {
  return {};
}

export function useGlobalSearchParams(): Record<string, string> {
  return {};
}

/** Screens re-read data on focus; a story is always focused. */
export function useFocusEffect(_effect: () => void | (() => void)) {}

export function Redirect(): null {
  return null;
}
