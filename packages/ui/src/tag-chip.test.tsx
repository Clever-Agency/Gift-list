// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { TagChip, TagChipList } from "./tag-chip";
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

  it("ошибка конкретного тега связана с его чекбоксом, а не с соседним", async () => {
    const error = { id: "tags-error", message: "Проверьте теги" };
    const { container, render } = mounted();
    await render(<TagChip label="мечта" selected onPress={vi.fn()} error={error} />);
    const chip = container.querySelector('[role="checkbox"]') as HTMLElement;

    expect(chip.getAttribute("aria-invalid")).toBe("true");
    expect(chip.getAttribute("aria-describedby")).toBe("tags-error");
  });

  it("без ошибки у чекбокса нет aria-invalid и aria-describedby", async () => {
    const { container, render } = mounted();
    await render(<TagChip label="мечта" selected onPress={vi.fn()} />);
    const chip = container.querySelector('[role="checkbox"]') as HTMLElement;

    expect(chip.getAttribute("aria-invalid")).toBeNull();
    expect(chip.getAttribute("aria-describedby")).toBeNull();
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

  it("ошибка своего тега связана с кнопкой удаления — единственным управлением чипа", async () => {
    const error = { id: "tags-error", message: "Проверьте теги" };
    const { container, render } = mounted();
    await render(
      <TagChip label="своё" removeLabel="Убрать тег своё" onRemove={vi.fn()} error={error} />,
    );

    const remove = container.querySelector('[role="button"]') as HTMLElement;
    expect(remove.getAttribute("aria-invalid")).toBe("true");
    expect(remove.getAttribute("aria-describedby")).toBe("tags-error");
  });
});

describe("TagChip: карточка", () => {
  it("статичный чип: текст без checkbox и кнопки", async () => {
    const { container, render } = mounted();
    await render(<TagChip variant="card" label="мечта" testID="tag" />);

    const chip = container.querySelector('[data-testid="tag"]') as HTMLElement;
    expect(chip).not.toBeNull();
    expect(chip.textContent).toBe("мечта");
    expect(container.querySelector('[role="checkbox"]')).toBeNull();
    expect(container.querySelector('[role="button"]')).toBeNull();
    expect(chip.getAttribute("tabindex")).toBeNull();
  });

  it("длинный свой текст остаётся целиком и переносится по ширине", async () => {
    const label = "очень длинный собственный тег";
    const { container, render } = mounted();
    await render(<TagChip variant="card" label={label} testID="tag" />);

    const chip = container.querySelector('[data-testid="tag"]') as HTMLElement;
    expect(chip.textContent).toBe(label);
    expect(getComputedStyle(chip).maxWidth).toBe("100%");
  });

  it("доступное имя заменяет видимый текст, когда он неполон", async () => {
    const { container, render } = mounted();
    await render(
      <TagChip
        variant="card"
        label="+2"
        accessibilityLabel="Ещё теги (2): своё, ещё одно"
        testID="tag"
      />,
    );

    const chip = container.querySelector('[data-testid="tag"]') as HTMLElement;
    expect(chip.textContent).toBe("+2");
    expect(chip.getAttribute("aria-label")).toBe("Ещё теги (2): своё, ещё одно");
  });
});

function plusHidden(hidden: number): string {
  return `+${hidden}`;
}

function hiddenSummary(hidden: number, labels: readonly string[]): string {
  return `Ещё теги (${hidden}): ${labels.join(", ")}`;
}

describe("TagChipList", () => {
  it("показывает не больше трёх чипов, остальные сворачивает в «+N»", async () => {
    const { container, render } = mounted();
    await render(
      <TagChipList
        labels={["мечта", "нужно сейчас", "когда-нибудь", "своё", "ещё одно"]}
        moreLabel={plusHidden}
        moreAccessibilityLabel={hiddenSummary}
        testID="tags"
      />,
    );

    const row = container.querySelector('[data-testid="tags"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.childElementCount).toBe(4);
    expect(getComputedStyle(row).flexWrap).toBe("wrap");
    expect(container.querySelector('[data-testid="tags-0"]')?.textContent).toBe("мечта");
    expect(container.querySelector('[data-testid="tags-1"]')?.textContent).toBe("нужно сейчас");
    expect(container.querySelector('[data-testid="tags-2"]')?.textContent).toBe("когда-нибудь");
    const more = container.querySelector('[data-testid="tags-more"]') as HTMLElement;
    expect(more.textContent).toBe("+2");
    expect(more.getAttribute("aria-label")).toBe("Ещё теги (2): своё, ещё одно");
    expect(container.querySelectorAll('[role="checkbox"]')).toHaveLength(0);
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });

  /** `DESIGN.md` -> WishCard: exactly three tags still fit; the fourth starts «+N». */
  it("граница: три тега без «+N»", async () => {
    const { container, render } = mounted();
    await render(
      <TagChipList
        labels={["мечта", "нужно сейчас", "когда-нибудь"]}
        moreLabel={plusHidden}
        testID="three"
      />,
    );

    const row = container.querySelector('[data-testid="three"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.childElementCount).toBe(3);
    expect(container.querySelector('[data-testid="three-0"]')?.textContent).toBe("мечта");
    expect(container.querySelector('[data-testid="three-1"]')?.textContent).toBe("нужно сейчас");
    expect(container.querySelector('[data-testid="three-2"]')?.textContent).toBe("когда-нибудь");
    expect(container.querySelector('[data-testid="three-more"]')).toBeNull();
  });

  it("граница: четвёртый тег сворачивается в «+1» с доступным именем", async () => {
    const { container, render } = mounted();
    await render(
      <TagChipList
        labels={["мечта", "нужно сейчас", "когда-нибудь", "своё"]}
        moreLabel={plusHidden}
        moreAccessibilityLabel={hiddenSummary}
        testID="four"
      />,
    );

    const row = container.querySelector('[data-testid="four"]') as HTMLElement;
    expect(row.childElementCount).toBe(4);
    expect(container.querySelector('[data-testid="four-0"]')?.textContent).toBe("мечта");
    expect(container.querySelector('[data-testid="four-1"]')?.textContent).toBe("нужно сейчас");
    expect(container.querySelector('[data-testid="four-2"]')?.textContent).toBe("когда-нибудь");
    expect(container.querySelector('[data-testid="four-3"]')).toBeNull();
    const more = container.querySelector('[data-testid="four-more"]') as HTMLElement;
    expect(more.textContent).toBe("+1");
    expect(more.getAttribute("aria-label")).toBe("Ещё теги (1): своё");
    expect(row.textContent).not.toContain("своё");
  });

  it("без скрытых тегов «+N» нет", async () => {
    const { container, render } = mounted();
    await render(
      <TagChipList labels={["мечта", "своё"]} moreLabel={plusHidden} testID="tags" />,
    );

    expect(container.textContent).toBe("мечтасвоё");
    expect(container.querySelector('[data-testid="tags-more"]')).toBeNull();
  });

  it("max задаёт число видимых чипов", async () => {
    const { container, render } = mounted();
    await render(
      <TagChipList
        labels={["мечта", "своё", "ещё одно"]}
        max={1}
        moreLabel={plusHidden}
        testID="tags"
      />,
    );

    expect(container.querySelector('[data-testid="tags-0"]')?.textContent).toBe("мечта");
    expect(container.querySelector('[data-testid="tags-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="tags-more"]')?.textContent).toBe("+2");
  });

  it("пустой список не рисует ряд", async () => {
    const { container, render } = mounted();
    await render(<TagChipList labels={[]} moreLabel={plusHidden} testID="tags" />);

    expect(container.querySelector('[data-testid="tags"]')).toBeNull();
    expect(container.textContent).toBe("");
  });
});
