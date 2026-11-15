import type { CircleCard } from "@gift-list/contracts";

/** `EXPERIENCE.md` → Friends infinite list: the next page starts 200 px before the end. */
export const CIRCLE_LOAD_THRESHOLD_PX = 200;

/** The rows of one page without a person who already sits in the loaded list. */
function withoutKnown(cards: CircleCard[], known: ReadonlySet<string>): CircleCard[] {
  return cards.filter((card) => !known.has(card.nick));
}

/**
 * One page appended to the loaded rows. The server pages on a stable sort, but a
 * like-named pair or a row that moved can repeat across a page boundary; a nick
 * appears once, keeping the first (older) position.
 */
export function appendCirclePage(current: CircleCard[], next: CircleCard[]): CircleCard[] {
  const known = new Set(current.map((card) => card.nick));
  return [...current, ...withoutKnown(next, known)];
}

/** The same rows with one person taken out; the list stays in server order. */
export function removeCircleCard(current: CircleCard[], nick: string): CircleCard[] {
  return current.filter((card) => card.nick !== nick);
}

/** The same rows with one person's fields replaced, e.g. an optimistic subscription. */
export function replaceCircleCard(
  current: CircleCard[],
  nick: string,
  apply: (card: CircleCard) => CircleCard,
): CircleCard[] {
  return current.map((card) => (card.nick === nick ? apply(card) : card));
}

/** Where the removed row's focus goes: the next row, else the previous one. */
export function focusNeighbour(items: readonly string[], removed: string): string | null {
  const index = items.indexOf(removed);
  if (index < 0) return null;
  return items[index + 1] ?? items[index - 1] ?? null;
}

/** The distance from the scroll position to the end of the content, in pixels. */
export type ScrollEdge = {
  /** How far the content still scrolls, i.e. `content - scroll - viewport`. */
  remaining: number;
};

type NativeScroll = {
  nativeEvent?: {
    contentOffset?: { y?: number };
    contentSize?: { height?: number };
    layoutMeasurement?: { height?: number };
  };
};

type DomScroll = {
  target?: { scrollTop?: number; scrollHeight?: number; clientHeight?: number } | null;
};

/**
 * The scroll position of one event on both runtimes. A phone reports
 * `nativeEvent`; the browser hands over the DOM event, where the page element
 * carries `scrollTop`/`scrollHeight`/`clientHeight`. An event without numbers is
 * not a reason to page.
 */
export function readScrollEdge(event: unknown): ScrollEdge | null {
  const native = (event as NativeScroll | null)?.nativeEvent;
  const offset = native?.contentOffset?.y;
  const content = native?.contentSize?.height;
  const viewport = native?.layoutMeasurement?.height;
  if (typeof offset === "number" && typeof content === "number" && typeof viewport === "number") {
    return { remaining: content - offset - viewport };
  }

  const target = (event as DomScroll | null)?.target;
  const top = target?.scrollTop;
  const scrollHeight = target?.scrollHeight;
  const clientHeight = target?.clientHeight;
  if (typeof top === "number" && typeof scrollHeight === "number" && typeof clientHeight === "number") {
    return { remaining: scrollHeight - top - clientHeight };
  }

  return null;
}

/**
 * `EXPERIENCE.md` → Friends infinite list: the next page starts when the content
 * is within `threshold` of the end. A page that is shorter than the viewport has
 * a negative remainder, which also means «подойти к концу».
 */
export function isNearListEnd(event: unknown, threshold = CIRCLE_LOAD_THRESHOLD_PX): boolean {
  const edge = readScrollEdge(event);
  if (edge === null) return false;
  return edge.remaining <= threshold;
}
