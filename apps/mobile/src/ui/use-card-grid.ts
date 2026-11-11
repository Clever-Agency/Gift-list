import { useCallback, useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardGrid, cardGridForContent, type CardGridPlacement } from "@/ui/card-grid";

/**
 * A measured width that moved by less than half a pixel is the same layout pass: the
 * browser reports fractional widths, and re-rendering on every rounding step would draw
 * nothing differently.
 */
const SAME_WIDTH = 0.5;

/**
 * W12.23: the card grid of the browser follows the content area, not the window. The
 * screen hands `attachContainer` to the box the cards are drawn in — the column content
 * area, after the CSS gutter and the `max-wide` cap — and the count and the width of the
 * cards come from that number (`DESIGN.md` → Layout → columns).
 *
 * Why the measurement: with a classic scrollbar the window is wider than the column by
 * the scrollbar's width, while the media query `medium` still counts the window.
 * `cardGrid(windowWidth)` therefore drew 552-px cards inside a 537-px column at a
 * 600-px window and left 9 px on the right instead of the 24 px gutter.
 *
 * Why a `ResizeObserver` and not `onLayout`: what moves the column is the container
 * itself — a scrollbar appearing when the list grows, a media query switching the gutter
 * — and none of those resize the window. `ResizeObserver` reports every such change in
 * the frame it happens; Tamagui's web `onLayout` is an IntersectionObserver polling loop
 * (~10 frames later) whose registry is private, so a test could not drive it. The
 * observer lives in an effect, so it is disconnected when the screen lets go of the box.
 *
 * The measurement only stores a width: the container's width comes from its parent
 * column, so the cards cannot change it and the measurement cannot feed back into
 * itself. A repeated width ends in a state update that changes nothing, so React bails
 * out and nothing re-renders after it. The first read happens in the ref callback,
 * before the first paint, so the first frame already has the real width. If no
 * measurement ever arrives (an old browser, a test DOM) the grid keeps the phone's
 * `cardGrid(windowWidth, insets)` numbers.
 */
export function useCardGrid(): CardGridPlacement {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const accept = useCallback(function acceptContentWidth(measured: number) {
    // A container that is hidden or not laid out yet reports 0: keep the fallback.
    if (!Number.isFinite(measured) || measured <= 0) return;
    setContentWidth((current) =>
      current !== null && Math.abs(current - measured) < SAME_WIDTH ? current : measured,
    );
  }, []);

  const attachContainer = useCallback(
    function attachContentContainer(element: unknown) {
      const next = element instanceof HTMLElement ? element : null;
      setContainer(next);
      // The container is in the DOM by now, so it can be measured before the paint.
      if (next) accept(next.getBoundingClientRect().width);
    },
    [accept],
  );

  useEffect(
    function watchContentWidth() {
      if (container === null || typeof ResizeObserver === "undefined") return undefined;
      const observer = new ResizeObserver(function reportContentWidth(entries) {
        const entry = entries[entries.length - 1];
        if (entry) accept(entry.contentRect.width);
      });
      observer.observe(container);
      return function stopWatching() {
        observer.disconnect();
      };
    },
    [container, accept],
  );

  const grid = contentWidth === null ? cardGrid(width, insets) : cardGridForContent(contentWidth);
  return { columns: grid.columns, cardWidth: grid.cardWidth, attachContainer };
}
