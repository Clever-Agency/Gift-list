// @vitest-environment happy-dom
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { Link } from "./text.stories";
import { createMount, declarationsFor, stateOf } from "./test-utils";

/**
 * W12.9-4: in the app `LinkText` sits inside the router's `<a>` (`NavLink`), so Tab
 * reaches the anchor. The standalone story used to render a bare `<span>` that Tab
 * skipped; it now gives the story-only `tabIndex` and `role="link"`, and this test
 * checks that the element is in the focus order and carries the `:focus-visible`
 * ring. The component itself is unchanged.
 */
const mounted = createMount();

const renderLink = Link.render as unknown as () => ReactElement;

describe("UI/Text → Link (story): фокусируемая ссылка", () => {
  it("у обеих ссылок tabIndex 0, роль link и кольцо :focus-visible", async () => {
    const { container, render } = mounted();
    await render(renderLink());

    const links = Array.from(container.querySelectorAll('[role="link"]'));
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.getAttribute("tabindex")).toBe("0");
      const ring = declarationsFor(link)
        .filter((one) => one.property.startsWith("outline") && stateOf(one) === "focus-visible")
        .map((one) => `${one.property}:${one.value}`);
      expect(ring).toContain("outline-color:var(--c-ring)");
      expect(ring).toContain("outline-width:2px");
    }
  });
});
