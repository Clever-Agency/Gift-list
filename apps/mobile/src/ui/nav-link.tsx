import { LinkText } from "@gift-list/ui";
import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";

/**
 * A navigation link of the anonymous screens: the router's `Link` around the shared
 * `LinkText`. On the web it is a real `<a href>` (`render="a"`), on the phone the text
 * takes the router's press.
 */
export function NavLink({ href, children }: { href: Href; children: ReactNode }) {
  return (
    <Link href={href} asChild>
      <LinkText render="a" role="link">
        {children}
      </LinkText>
    </Link>
  );
}

NavLink.displayName = "NavLink";
