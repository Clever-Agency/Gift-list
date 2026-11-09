import { useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import type { PageScrollView } from "./field-scroll.types";
import { registerPageScroll } from "./field-scroll";
import { ScrollView, type ScrollViewProps } from "./scroll";

export type PageScrollProps = {
  children: ReactNode;
  testID?: string;
  /** Forms keep the keyboard open while the user taps a control. */
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
};

type PageLayoutEvent = { nativeEvent: { layout: { height: number } } };

/** Height of the visible scroll viewport from the ScrollView layout event. */
export function pageViewportHeight(event: PageLayoutEvent): number {
  return event.nativeEvent.layout.height;
}

/**
 * The single scroll area of a page. The header, the content and the page footer
 * scroll together, so a screen must not nest another bounded scroller inside it
 * (`DESIGN.md` → Layout). On the phone this is the standard screen ScrollView;
 * on the web it is the one full-height scroll area of the screen.
 *
 * The phone publishes this ScrollView as the page the form errors scroll within
 * (UI5): `focus.native.ts` moves the first invalid field to the middle of the
 * viewport before focus. The viewport height comes from the layout pass.
 */
export function PageScroll({ children, testID, keyboardShouldPersistTaps }: PageScrollProps) {
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const viewportHeight = useRef(0);

  useEffect(function registerPageScrollView() {
    const node = scroller.current as unknown as PageScrollView | null;
    if (!node) return undefined;
    return registerPageScroll({
      scrollView: node,
      viewportHeight: function readViewportHeight() {
        return viewportHeight.current;
      },
    });
  }, []);

  function handleLayout(event: PageLayoutEvent) {
    viewportHeight.current = pageViewportHeight(event);
  }

  return (
    <ScrollView
      testID={testID}
      ref={scroller}
      onLayout={handleLayout}
      flex={1}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </ScrollView>
  );
}

PageScroll.displayName = "PageScroll";
