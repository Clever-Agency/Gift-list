// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClosedSection } from "@/ui/closed-section";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

async function render(
  expanded: boolean,
  onToggle: () => void = function noop() {},
) {
  await act(async () => {
    host.render(
      <ClosedSection
        label="Получено (2)"
        expanded={expanded}
        onToggle={onToggle}
        testID="closed-section"
        toggleTestID="closed-section-toggle"
      >
        <div role="listitem">Плед</div>
        <div role="listitem">Свитер</div>
      </ClosedSection>,
    );
  });
}

function toggle(): HTMLElement {
  const node = container.querySelector<HTMLElement>('[data-testid="closed-section-toggle"]');
  expect(node).not.toBeNull();
  return node as HTMLElement;
}

/**
 * Story 5.3 (`DESIGN.md` → Мелкие элементы, `EXPERIENCE.md` → State Patterns):
 * «Получено (N)» / «Уже подарено» / «Архив (N)» — свёрнутая секция с
 * заголовком-кнопкой и `aria-expanded`; свёрнутая не держит карточки в дереве.
 */
describe("ClosedSection: свёрнутая секция закрытых желаний", () => {
  it("свёрнута: заголовок есть, карточек в дереве нет, aria-expanded = false", async () => {
    await render(false);

    expect(container.textContent).toContain("Получено (2)");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(0);
    expect(container.querySelector('[role="list"]')).toBeNull();
  });

  it("заголовок — кнопка на 44 px, а не пункт меню", async () => {
    await render(false);

    expect(toggle().getAttribute("role")).toBe("button");
    expect(toggle().getAttribute("tabindex")).toBe("0");
  });

  it("раскрыта: карточки в сетке-списке и aria-expanded = true", async () => {
    await render(true);

    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('[role="list"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="list"] [role="listitem"]')).toHaveLength(2);
    expect(container.textContent).toContain("Плед");
    expect(container.textContent).toContain("Свитер");
  });

  it("нажатие на заголовок сообщает onToggle, состояние задаёт экран", async () => {
    const onToggle = vi.fn();
    await render(false, onToggle);

    await act(async () => {
      toggle().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
    // Controlled: the section stays as the screen rendered it.
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });
});
