import type { ReactNode } from "react";
import { ScrollView, type ScrollViewProps } from "./scroll";

export type PageScrollProps = {
  children: ReactNode;
  testID?: string;
  /** Forms keep the keyboard open while the user taps a control. */
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
};

/**
 * The single scroll area of a page. The header, the content and the page footer
 * scroll together, so a screen must not nest another bounded scroller inside it
 * (`DESIGN.md` → Layout). On the phone this is the standard screen ScrollView;
 * on the web it is the one full-height scroll area of the screen.
 */
export function PageScroll({ children, testID, keyboardShouldPersistTaps }: PageScrollProps) {
  return (
    <ScrollView
      testID={testID}
      flex={1}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </ScrollView>
  );
}

PageScroll.displayName = "PageScroll";
