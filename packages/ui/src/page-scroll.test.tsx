// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Column, PageContainer } from "./layout";
import { PageScroll } from "./page-scroll";
import { createMount } from "./test-utils";

describe("PageScroll", () => {
  const mounted = createMount();

  it("is the one scroll area and its content fills the page", async () => {
    const view = mounted();
    await view.render(
      <PageScroll testID="page">
        <span>header</span>
        <span>content</span>
      </PageScroll>,
    );

    const area = view.container.querySelector('[data-testid="page"]');
    expect(area).not.toBeNull();
    expect(area?.textContent).toBe("headercontent");
    expect(getComputedStyle(area as Element).overflowY).toBe("auto");

    const content = area?.firstElementChild;
    expect(content).not.toBeNull();
    expect(getComputedStyle(content as Element).flexGrow).toBe("1");
  });
});

describe("PageContainer", () => {
  const mounted = createMount();

  it("keeps one max-wide frame while the inner column stays narrower", async () => {
    const view = mounted();
    await view.render(
      <PageContainer testID="frame">
        <Column size="form" testID="form">
          content
        </Column>
      </PageContainer>,
    );

    const frame = view.container.querySelector('[data-testid="frame"]');
    expect(frame).not.toBeNull();
    expect(getComputedStyle(frame as Element).maxWidth).toBe("1120px");
    expect(getComputedStyle(frame as Element).width).toBe("100%");
    expect(getComputedStyle(frame as Element).alignSelf).toBe("center");

    const form = view.container.querySelector('[data-testid="form"]');
    expect(form).not.toBeNull();
    expect(getComputedStyle(form as Element).maxWidth).toBe("560px");
  });
});
