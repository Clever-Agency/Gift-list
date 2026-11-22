// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";
import { createMount } from "./test-utils";

const mounted = createMount();

describe("Badge", () => {
  it("рисует число и прячет его от диктора: подпись несёт родитель", async () => {
    const { container, render } = mounted();
    await render(<Badge count={2} testID="badge" />);

    const badge = container.querySelector<HTMLElement>("[data-testid='badge']");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("2");
    expect(badge?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("больше 99 — «99+»", async () => {
    const { container, render } = mounted();
    await render(<Badge count={120} testID="badge" />);

    expect(container.querySelector("[data-testid='badge']")?.textContent).toBe("99+");
  });

  it("ноль и отрицательное число не рисуют badge", async () => {
    const { container, render } = mounted();
    await render(<Badge count={0} testID="badge" />);
    expect(container.textContent).toBe("");
    expect(container.querySelectorAll("[data-testid='badge']")).toHaveLength(0);

    await render(<Badge count={-3} testID="badge" />);
    expect(container.textContent).toBe("");
  });

  it("displayName совпадает с именем компонента", () => {
    expect(Badge.displayName).toBe("Badge");
  });
});
