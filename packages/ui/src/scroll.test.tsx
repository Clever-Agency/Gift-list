// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ScrollView } from "./scroll";
import { createMount } from "./test-utils";

describe("ScrollView", () => {
  const mounted = createMount();

  it("renders its children inside a scrollable box", async () => {
    const view = mounted();
    await view.render(
      <ScrollView flex={1} testID="area">
        <span>content</span>
      </ScrollView>,
    );
    const area = view.container.querySelector('[data-testid="area"]');
    expect(area).not.toBeNull();
    expect(area?.textContent).toBe("content");
    expect(getComputedStyle(area as Element).overflowY).toBe("auto");
  });
});
