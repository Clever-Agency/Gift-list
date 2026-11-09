import { YStack } from "@tamagui/stacks";
import type { ReactNode } from "react";
import { Text } from "./text";

export type PageFooterProps = {
  /** The one line of footer copy; the app passes the catalog phrase. */
  tagline: string;
  /** Links or page actions shown above the tagline. */
  children?: ReactNode;
  testID?: string;
};

/**
 * The one page footer of the app: the content and the footer share a single scroll
 * area, so this box is the last child of the page column, not a sticky overlay. On a
 * short page the column's `flexGrow` pushes it to the bottom.
 *
 * `role="contentinfo"` gives the web build the `footer` landmark. The package owns
 * layout only: copy and links come from the app.
 */
export function PageFooter({ tagline, children, testID = "page-footer" }: PageFooterProps) {
  return (
    <YStack
      role="contentinfo"
      testID={testID}
      width="100%"
      alignItems="center"
      paddingTop="$section-gap"
      paddingBottom="$page-gutter"
      gap="$grid-gap"
    >
      {children}
      <Text kind="caption" tone="muted" textAlign="center">
        {tagline}
      </Text>
    </YStack>
  );
}

PageFooter.displayName = "PageFooter";
