// @vitest-environment happy-dom
import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SegmentTabs, type SegmentTab } from "./segment-tabs";
import { createMount, stateValues } from "./test-utils";

const mounted = createMount();

const tabs: SegmentTab[] = [
  { key: "friends", label: "Друзья" },
  { key: "subscriptions", label: "Подписки" },
  { key: "requests", label: "Запросы", badge: 3 },
];

function tab(container: HTMLElement, label: string): HTMLElement {
  const node = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  expect(node, `вкладка «${label}»`).not.toBeNull();
  return node as HTMLElement;
}

function noop() {}

/** A controlled segment, as a screen wires it. */
function LiveSegment({ onChange }: { onChange?: (key: string) => void }) {
  const [value, setValue] = useState("friends");
  function change(next: string) {
    setValue(next);
    onChange?.(next);
  }
  return <SegmentTabs label="Разделы друзей" tabs={tabs} value={value} onChange={change} />;
}

describe("SegmentTabs", () => {
  it("рисует вкладки, выделяет выбранную и читает счётчик вместе с названием", async () => {
    const { container, render } = mounted();
    await render(<SegmentTabs label="Разделы друзей" tabs={tabs} value="friends" onChange={noop} />);

    expect(container.querySelector('[role="tablist"]')?.getAttribute("aria-label")).toBe(
      "Разделы друзей",
    );
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(tab(container, "Друзья").getAttribute("aria-selected")).toBe("true");
    expect(tab(container, "Подписки").getAttribute("aria-selected")).toBe("false");
    expect(tab(container, "Запросы, 3")).not.toBeNull();
  });

  it("нажатие выбирает вкладку", async () => {
    const onChange = vi.fn();
    const { container, render } = mounted();
    await render(<LiveSegment onChange={onChange} />);

    await act(async () => {
      tab(container, "Подписки").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith("subscriptions");
    expect(tab(container, "Подписки").getAttribute("aria-selected")).toBe("true");
    expect(tab(container, "Друзья").getAttribute("aria-selected")).toBe("false");
  });

  it("стрелки вправо и влево переключают соседнюю вкладку и переносят фокус", async () => {
    const { container, render } = mounted();
    await render(<LiveSegment />);

    tab(container, "Друзья").focus();
    await act(async () => {
      tab(container, "Друзья").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
    });

    expect(tab(container, "Подписки").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab(container, "Подписки"));

    await act(async () => {
      tab(container, "Подписки").dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
    });

    expect(tab(container, "Друзья").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab(container, "Друзья"));
  });

  it("без счётчика подпись вкладки — только её название", async () => {
    const { container, render } = mounted();
    await render(
      <SegmentTabs
        label="Разделы друзей"
        tabs={tabs.map((item) => ({ ...item, badge: undefined }))}
        value="friends"
        onChange={noop}
      />,
    );

    expect(tab(container, "Запросы")).not.toBeNull();
  });

  /**
   * CLE-129: a tab is a control, so it answers the pointer with the `$muted` fill
   * of `Pressable` and changes it with the `quick` preset.
   */
  it("вкладка получает hover muted и плавный переход", async () => {
    const { container, render } = mounted();
    await render(<SegmentTabs label="Разделы друзей" tabs={tabs} value="friends" onChange={noop} />);

    const node = tab(container, "Подписки");
    expect(stateValues(node, "hover", "background-color")).toEqual(["var(--muted)"]);
    expect(node.style.transition).toContain("160ms");
  });
});
