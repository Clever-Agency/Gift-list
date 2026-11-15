// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { OverflowMenu } from "./overflow-menu";
import { createMount, declarationsFor, settle } from "./test-utils";

const mounted = createMount();

function trigger(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>('[aria-label="Действия: Алёна"]');
  expect(node, "кнопка ⋯").not.toBeNull();
  return node as HTMLElement;
}

function item(label: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>("[role='button']")).find(
    (node) => (node.textContent ?? "") === label,
  ) ?? null;
}

const items = [
  { key: "profile", label: "Открыть профиль", onPress: noop },
  { key: "cancel", label: "Отменить приглашение", onPress: noop },
];

function noop() {}

describe("OverflowMenu", () => {
  it("⋯ — кнопка 44×44 с подписью для диктора и закрытым меню", async () => {
    const { container, render } = mounted();
    await render(<OverflowMenu label="Действия: Алёна" title="Алёна" items={items} />);

    const button = trigger(container);
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.textContent).toBe("⋯");
    expect(declarationsFor(button, "width").map((item) => item.value)).toContain(
      "var(--t-size-touch-target)",
    );
    expect(declarationsFor(button, "height").map((item) => item.value)).toContain(
      "var(--t-size-touch-target)",
    );
    expect(document.querySelector("[role='dialog'][data-state='open']")).toBeNull();
  });

  it("нажатие открывает шторку с именем человека и пунктами", async () => {
    const { container, render } = mounted();
    await render(<OverflowMenu label="Действия: Алёна" title="Алёна" items={items} />);

    await act(async () => {
      trigger(container).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(300);

    expect(container.ownerDocument.body.textContent).toContain("Алёна");
    expect(item("Открыть профиль")).not.toBeNull();
    expect(item("Отменить приглашение")).not.toBeNull();
    expect(trigger(container).getAttribute("aria-expanded")).toBe("true");
  });

  it("пункт вызывает своё действие", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <OverflowMenu
        label="Действия: Алёна"
        title="Алёна"
        items={[{ key: "profile", label: "Открыть профиль", onPress }]}
      />,
    );

    await act(async () => {
      trigger(container).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(300);

    await act(async () => {
      item("Открыть профиль")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("деструктивные пункты идут последними, после разделителя, в каком бы порядке их ни передали", async () => {    const { container, render } = mounted();
    await render(
      <OverflowMenu
        label="Действия: Алёна"
        title="Алёна"
        items={[
          { key: "block", label: "Заблокировать", onPress: noop, destructive: true },
          { key: "profile", label: "Открыть профиль", onPress: noop },
        ]}
      />,
    );

    await act(async () => {
      trigger(container).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(300);

    const profile = item("Открыть профиль");
    const block = item("Заблокировать");
    expect(profile).not.toBeNull();
    expect(block).not.toBeNull();
    expect(profile?.compareDocumentPosition(block as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
