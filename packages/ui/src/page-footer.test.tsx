// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { PageFooter } from "./page-footer";
import { createMount } from "./test-utils";

const mounted = createMount();

describe("PageFooter", () => {
  it("это landmark contentinfo с текстом и дополнительными ссылками", async () => {
    const { container, render } = mounted();
    await render(
      <PageFooter tagline="Сделано с любовью командой cleverAgency">
        <a href="/about">О проекте</a>
      </PageFooter>,
    );

    const footer = container.querySelector<HTMLElement>('[data-testid="page-footer"]');
    expect(footer).not.toBeNull();
    expect(footer?.getAttribute("role")).toBe("contentinfo");
    expect(footer?.textContent).toContain("Сделано с любовью командой cleverAgency");
    expect(footer?.textContent).toContain("О проекте");
    expect(footer?.querySelector("a")?.getAttribute("href")).toBe("/about");
  });

  it("testID можно переопределить", async () => {
    const { container, render } = mounted();
    await render(<PageFooter tagline="Подвал" testID="custom-footer" />);

    expect(container.querySelector('[data-testid="page-footer"]')).toBeNull();
    expect(container.querySelector('[data-testid="custom-footer"]')).not.toBeNull();
  });
});
