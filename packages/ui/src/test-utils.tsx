import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach } from "vitest";
import { createGiftListConfig } from "./config";
import { GiftListProvider } from "./provider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** One config per test file, as in an app (createTamagui registers itself globally). */
export const testConfig = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

export function withProvider(element: ReactElement): ReactElement {
  return <GiftListProvider config={testConfig}>{element}</GiftListProvider>;
}

export type Mounted = {
  container: HTMLDivElement;
  /** Renders into the provider; call again to update props. */
  render: (element: ReactElement) => Promise<void>;
};

/** Mounts into `document.body` with the provider; unmounts after each test. */
export function createMount(): () => Mounted {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    document.body.innerHTML = "";
  });

  return function mounted() {
    return {
      container: container as HTMLDivElement,
      async render(element) {
        await act(async () => {
          root?.render(withProvider(element));
        });
      },
    };
  };
}

/** Lets timers and animation frames queued by a layer run. */
export async function settle(ms = 50): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/**
 * Every attribute of the tree whose name starts with `accessibility`. The props
 * are React Native only: in the web DOM they would be unknown `accessibilityhint`
 * attributes a browser never reads.
 */
export function nativeOnlyAttributes(root: ParentNode): string[] {
  const names: string[] = [];
  for (const node of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name.toLowerCase().startsWith("accessibility")) names.push(attribute.name);
    }
  }
  return names;
}

/** All `console.error` calls of a spy joined into one string for a readable assertion. */
export function errorMessages(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
}

/**
 * One declaration Tamagui generated into `document.styleSheets`. happy-dom paints
 * nothing, so a state of a component is checked as the CSS rule it produced.
 */
export type CssDeclaration = {
  selector: string;
  property: string;
  value: string;
  /** The declaration sits inside `@media (hover: hover)`. */
  hover: boolean;
};

/** `selector { property: value; }` pairs of one rule text, media query or not. */
function declarationsOfRule(text: string, hover: boolean): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  for (const [, selector, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const [, property, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
      out.push({ selector: selector.replace(/\s+/g, " ").trim(), property, value: value.trim(), hover });
    }
  }
  return out;
}

/** Every rule Tamagui put into the document, flattened to single declarations. */
export function allDeclarations(): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      const hover = rule.cssText.startsWith("@media (hover: hover)");
      if (rule.cssText.startsWith("@media") && !hover) continue;
      out.push(...declarationsOfRule(rule.cssText, hover));
    }
  }
  return out;
}

/** The declarations that apply to `element` (one of its atomic classes is in the selector). */
export function declarationsFor(
  element: Element,
  property?: string,
  hover?: boolean,
): CssDeclaration[] {
  const classes = Array.from(element.classList);
  return allDeclarations().filter(
    (declaration) =>
      classes.some((name) => declaration.selector.includes(`.${name}`)) &&
      (property === undefined || declaration.property === property) &&
      (hover === undefined || declaration.hover === hover),
  );
}

/**
 * The state a rule paints, in the names of `DESIGN.md`: `hover`, `press` (the CSS
 * `:active` Tamagui emits), `focus-visible`… Tamagui wraps every state selector in
 * `:where(…)`; a rule without one is the resting state.
 */
export function stateOf(declaration: CssDeclaration): string {
  const state = declaration.selector.match(/:where\(:([a-z-]+)\)/)?.[1];
  return state === "active" ? "press" : (state ?? "base");
}

/** The values `property` takes on `element` in one state, e.g. the `press` opacity. */
export function stateValues(element: Element, state: string, property: string): string[] {
  return declarationsFor(element, property)
    .filter((declaration) => stateOf(declaration) === state)
    .map((declaration) => declaration.value);
}
