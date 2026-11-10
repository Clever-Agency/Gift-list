import { spacing } from "@gift-list/ui";

/**
 * W12.12/W12.13 (`DESIGN.md` → App → Точки перехода, «Реализация раскладки»): a
 * screen's gutter is a Tamagui media clause, so the browser turns it into a CSS
 * media query and the phone uses the same key.
 *
 * happy-dom does not apply `@media` rules to computed styles, so these helpers
 * read the CSS Tamagui actually generated: the base rule and the
 * `@media (min-width: …)` rule for the element's class, with the window width
 * deciding which one wins. Nothing here is a browser layout: real rendering on a
 * phone and in a browser is a manual check.
 */

/**
 * One `property: value` declaration of the generated CSS: `minWidth` is the
 * `@media (min-width: …)` of the rule it sits in, `null` outside a media rule and
 * `NaN` for a media rule of another kind (never matches below).
 */
export type Declaration = {
  minWidth: number | null;
  selector: string;
  property: string;
  value: string;
};

function declarationsOf(cssText: string, minWidth: number | null): Declaration[] {
  const out: Declaration[] = [];
  for (const [, selector, body] of cssText.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const [, property, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
      out.push({ minWidth, selector: selector.trim(), property, value: value.trim() });
    }
  }
  return out;
}

/** Every rule Tamagui put into the document, media rules kept with their condition. */
export function generatedCss(): Declaration[] {
  const out: Declaration[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      const media = rule as CSSRule & { media?: { mediaText: string }; cssRules?: CSSRuleList };
      if (media.media && media.cssRules) {
        const found = media.media.mediaText.match(/min-width:\s*(\d+)px/)?.[1];
        const minWidth = found === undefined ? Number.NaN : Number(found);
        for (const inner of Array.from(media.cssRules)) {
          out.push(...declarationsOf(inner.cssText, minWidth));
        }
        continue;
      }
      out.push(...declarationsOf(rule.cssText, null));
    }
  }
  return out;
}

/** The declarations of `property` whose selector names one of the element's classes. */
export function declarationsFor(element: Element, property: string): Declaration[] {
  const classes = Array.from(element.classList);
  return generatedCss().filter(
    (declaration) =>
      declaration.property === property &&
      classes.some((name) => declaration.selector.includes(`.${name}`)),
  );
}

/**
 * The `property` the element's CSS paints at `width`: the last matching rule wins,
 * and a rule inside `@media (min-width: N)` applies from N.
 */
export function paintedValue(
  element: Element,
  property: string,
  width: number,
): string | undefined {
  let value: string | undefined;
  for (const declaration of declarationsFor(element, property)) {
    if (declaration.minWidth !== null && !(width >= declaration.minWidth)) continue;
    value = declaration.value;
  }
  return value;
}

/**
 * Same as `paintedValue`, for a property set to a theme token: the values are
 * references (`var(--t-space-page-gutter)`), so they resolve through `spacing`.
 */
export function paintedSpace(
  element: Element,
  property: string,
  width: number,
): number | undefined {
  const token = paintedValue(element, property, width)?.match(/var\(--t-space-([\w-]+)\)/)?.[1];
  if (token === undefined) return undefined;
  return spacing[token as keyof typeof spacing];
}
