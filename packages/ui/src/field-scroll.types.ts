/** A host node that can report its box relative to an ancestor view. */
export type MeasurableNode = {
  measureLayout(
    relativeToNativeNode: object,
    onSuccess: (x: number, y: number, width: number, height: number) => void,
    onFail?: () => void,
  ): void;
};

/**
 * The page ScrollView as far as the scroll helper needs it: the inner container
 * (the measured ancestor) and the imperative instant scroll.
 */
export type PageScrollView = {
  scrollTo(options: { y: number; animated?: boolean }): void;
  getInnerViewRef?(): object | null;
};

/** What `PageScroll` publishes while it is on screen. */
export type PageScrollRegistration = {
  scrollView: PageScrollView;
  /** Height of the visible scroll viewport; `0` until the first layout pass. */
  viewportHeight(): number;
};
