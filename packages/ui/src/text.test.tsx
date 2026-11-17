// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Heading, LinkText, Text } from "./text";
import { createMount, testConfig } from "./test-utils";

const mounted = createMount();

/**
 * The atom rules Tamagui emitted for the classes of `node`. happy-dom does not
 * compute real `:hover` / `:focus-visible` states, so the test reads the CSS the
 * classes point at instead of pretending to hover or press Tab.
 */
function styleLines(node: Element): string[] {
  const css = testConfig.getCSS();
  const classes = Array.from(node.classList);
  return css.split("\n").filter(function mentionsClass(line) {
    return classes.some(function isClassOfNode(name) {
      return new RegExp(`\\.${name.replace(/[-_]/g, "\\$&")}(?![\\w-])`).test(line);
    });
  });
}

function focusVisibleOutline(lines: string[], declaration: string): boolean {
  return lines.some(function hasDeclaration(line) {
    return line.includes(":focus-visible") && line.includes(declaration);
  });
}

function link(container: HTMLElement): HTMLAnchorElement {
  const anchors = container.querySelectorAll("a");
  expect(anchors).toHaveLength(1);
  return anchors[0] as HTMLAnchorElement;
}

/**
 * `NavLink` receives `href` from the router's `asChild` link, not from `LinkText`
 * props (they are React Native text props), so the test puts it on the same `<a>`
 * the router fills in.
 */
const anchorProps = { href: "/login", render: "a", role: "link" } as const;

function linkText() {
  return <LinkText {...anchorProps}>Войти</LinkText>;
}

describe("LinkText: кольцо фокуса, hover и press", () => {
  it("на вебе это настоящая <a> с текстом, ролью ссылки и href от роутера", async () => {
    const { container, render } = mounted();
    await render(linkText());

    const anchor = link(container);
    expect(anchor.getAttribute("href")).toBe("/login");
    expect(anchor.getAttribute("role")).toBe("link");
    expect(anchor.textContent).toBe("Войти");
    expect(container.querySelectorAll("a a")).toHaveLength(0);
  });

  it("кольцо $ring 2 px с отступом 2 висит на :focus-visible, а не на голом :focus", async () => {
    const { container, render } = mounted();
    await render(linkText());

    const lines = styleLines(link(container));
    expect(focusVisibleOutline(lines, "outline-color:var(--c-ring)")).toBe(true);
    expect(focusVisibleOutline(lines, "outline-width:2px")).toBe(true);
    expect(focusVisibleOutline(lines, "outline-style:solid")).toBe(true);
    expect(lines.some((line) => line.includes("outline-offset:2px"))).toBe(true);
    // A mouse click focuses the link too: an outline on plain `:focus` would show the
    // ring after every click, so no rule may depend on it.
    const plainFocus = lines.filter(
      (line) => /:focus(?!-visible)/.test(line) && line.includes("outline"),
    );
    expect(plainFocus).toEqual([]);
  });

  it("hover даёт фон $background только при указателе, press — непрозрачность 0.9", async () => {
    const { container, render } = mounted();
    await render(linkText());

    const lines = styleLines(link(container));
    expect(
      lines.some(
        (line) =>
          line.includes("@media (hover: hover)") &&
          line.includes(":where(:hover)") &&
          line.includes("background-color:var(--c-background)"),
      ),
    ).toBe(true);
    expect(
      lines.some((line) => line.includes(":where(:active)") && line.includes("opacity:0.9")),
    ).toBe(true);
    // The touch target of DESIGN.md stays 44 px tall.
    expect(lines.some((line) => line.includes("min-height:var(--t-size-touch-target)"))).toBe(true);
  });

  it("Text и Heading не получают кольца, hover-фона и press-непрозрачности", async () => {
    const { container, render } = mounted();
    await render(
      <>
        <Text>Обычный текст</Text>
        <Heading level={2}>Заголовок</Heading>
      </>,
    );

    for (const node of Array.from(container.querySelectorAll("[name='GLText']"))) {
      const lines = styleLines(node);
      expect(lines.filter((line) => line.includes("outline-width"))).toEqual([]);
      expect(lines.filter((line) => line.includes(":where(:hover)"))).toEqual([]);
      expect(lines.filter((line) => line.includes(":where(:active)"))).toEqual([]);
    }
    expect(container.querySelector("[role='heading']")?.getAttribute("aria-level")).toBe("2");
  });
});
