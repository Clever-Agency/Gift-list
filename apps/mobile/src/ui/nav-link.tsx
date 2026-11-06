import { LinkText } from "@gift-list/ui";
import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";

/**
 * A navigation link of the anonymous screens: the router's `Link` around the shared
 * `LinkText`. On the web it is a real `<a href>` (`render="a"`), on the phone the text
 * takes the router's press.
 *
 * `onPress` runs before the router navigates, so a screen can hand state to the target
 * without putting it in the URL. A modified click or a new tab skips navigation and
 * therefore skips the hand-off: such a deep link opens with an empty field by design.
 */
export function NavLink({
  href,
  onPress,
  children,
}: {
  href: Href;
  onPress?: () => void;
  children: ReactNode;
}) {
  return (
    <Link href={href} asChild onPress={onPress}>
      <LinkText render="a" role="link">
        {children}
      </LinkText>
    </Link>
  );
}

NavLink.displayName = "NavLink";
