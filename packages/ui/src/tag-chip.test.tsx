// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { TagChip } from "./tag-chip";
import { createMount } from "./test-utils";

const mounted = createMount();

async function click(node: Element) {
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("TagChip: фиксированный тег", () => {
  it("это checkbox с подписью сервера и состоянием выбора", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<TagChip label="мечта" selected onPress={onPress} />);
    const chip = container.querySelector('[role="checkbox"]') as HTMLElement;

    expect(chip).not.toBeNull();
    expect(chip.getAttribute("aria-label")).toBe("мечта");
    expect(chip.getAttribute("aria-checked")).toBe("true");
    expect(chip.textContent).toContain("мечта");

    await click(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("невыбранный чип сообщает aria-checked=false", async () => {
    const { container, render } = mounted();
    await render(<TagChip label="нужно сейчас" selected={false} onPress={vi.fn()} />);
    const chip = container.querySelector('[role="checkbox"]') as HTMLElement;

    expect(chip.getAttribute("aria-checked")).toBe("false");
  });

  it("Enter и пробел переключают фиксированный тег", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(<TagChip label="мечта" onPress={onPress} />);
    const chip = container.querySelector('[role="checkbox"]') as HTMLElement;

    await act(async () => {
      chip.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      chip.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });

    expect(onPress).toHaveBeenCalledTimes(2);
  });
});

describe("TagChip: свой тег", () => {
  it("чип с крестиком: подпись и доступное имя «Убрать тег»", async () => {
    const onRemove = vi.fn();
    const { container, render } = mounted();
    await render(
      <TagChip
        label="своё"
        removeLabel="Убрать тег своё"
        onRemove={onRemove}
      />,
    );

    expect(container.querySelector('[role="checkbox"]')).toBeNull();
    const remove = container.querySelector('[role="button"]') as HTMLElement;
    expect(remove.getAttribute("aria-label")).toBe("Убрать тег своё");
    expect(container.textContent).toContain("своё");

    await click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
