// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { RelationshipChip } from "./relationship-chip";
import { createMount } from "./test-utils";

const mounted = createMount();

describe("RelationshipChip: отношение", () => {
  it("показывает подпись и не является кнопкой", async () => {
    const { container, render } = mounted();
    await render(<RelationshipChip label="Друзья" testID="relation" />);
    const chip = container.querySelector('[data-testid="relation"]') as HTMLElement;

    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain("Друзья");
    expect(chip.getAttribute("role")).toBeNull();
    expect(chip.querySelector("button")).toBeNull();
  });

  it("подчёркивает входящее приглашение цветом primary", async () => {
    const { container, render } = mounted();
    await render(<RelationshipChip label="Зовёт в друзья" emphasis />);
    const text = container.querySelector("span, div");

    expect(container.textContent).toContain("Зовёт в друзья");
    expect(text).not.toBeNull();
  });
});
