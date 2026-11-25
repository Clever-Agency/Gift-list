// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, dialogElement, controls } from "@/test/dom";
import { declarationsFor } from "@/test/tamagui-css";
import { GiftCardMenu, type GiftCardMenuAction } from "@/ui/gift-card-menu";

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

function action(key: string, label: string, onPress = function noop() {}): GiftCardMenuAction {
  return { key, label, onPress };
}

async function render({
  open = true,
  actions = [
    action("undo", "Вернуть в открытые · ещё 5 мин"),
    action("copy", "Хочу ещё такой"),
    { ...action("delete", "Удалить"), destructive: true },
  ] as GiftCardMenuAction[],
  onClose = function noop() {},
  onClosed,
  onSelect = function noop() {},
}: {
  open?: boolean;
  actions?: GiftCardMenuAction[];
  onClose?: () => void;
  onClosed?: () => void;
  onSelect?: (action: GiftCardMenuAction) => void;
} = {}) {
  await act(async () => {
    host.render(
      <GiftCardMenu
        open={open}
        title="Плед"
        actions={actions}
        closeLabel="Закрыть"
        onClose={onClose}
        onClosed={onClosed}
        onSelect={onSelect}
        testID="card-menu"
      />,
    );
  });
}

function item(label: string): HTMLElement | undefined {
  return controls(dialogElement() ?? document).find(function sameLabel(node) {
    return (node.textContent ?? "").trim() === label;
  });
}

/**
 * Story 5.3: меню ⋯ закрытого желания. Слой — тот же `Dialog`, что у меню
 * архива; пункты и их доступность решает экран, поэтому здесь проверяется только
 * отрисовка, порядок и то, что нажатие отдаёт пункт наружу.
 */
describe("GiftCardMenu: меню ⋯ карточки", () => {
  it("закрытое меню не держит слой в дереве", async () => {
    await render({ open: false });

    expect(dialogElement()).toBeNull();
  });

  it("открытое меню называет желание и рисует пункты по порядку", async () => {
    await render();

    const dialog = dialogElement();
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Плед");
    const labels = controls(dialog as HTMLElement).map(function textOf(node) {
      return (node.textContent ?? "").trim();
    });
    expect(labels).toEqual(["Вернуть в открытые · ещё 5 мин", "Хочу ещё такой", "Удалить", "Закрыть"]);
  });

  it("нажатие пункта отдаёт его наружу и не закрывает слой само", async () => {
    const onUndo = vi.fn();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    await render({
      actions: [action("undo", "Вернуть в открытые · ещё 5 мин", onUndo)],
      onSelect,
      onClose,
    });

    await click(item("Вернуть в открытые · ещё 5 мин"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    // The screen owns the work: the menu only reports the chosen item.
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ key: "undo" });
    expect(onUndo).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(dialogElement()).not.toBeNull();
  });

  it("удаление — последний пункт и коралловое (destructive)", async () => {
    await render();

    const deleteItem = item("Удалить");
    expect(deleteItem).toBeDefined();
    // The resting fill, not a hover state.
    const fill = declarationsFor(deleteItem as Element, "background-color").filter(
      (one) => !one.selector.includes(":where("),
    );
    expect(fill[fill.length - 1]?.value).toBe("var(--destructive)");
  });

  it("«Закрыть» закрывает слой, экран решает, когда убрать меню", async () => {
    const onClose = vi.fn();
    await render({ onClose });

    await click(item("Закрыть"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("окно отмены закрылось: пункта возврата нет, копия и удаление остались", async () => {
    await render({
      actions: [action("copy", "Хочу ещё такой"), { ...action("delete", "Удалить"), destructive: true }],
    });

    expect(item("Хочу ещё такой")).toBeDefined();
    expect(item("Удалить")).toBeDefined();
    expect(item("Вернуть в открытые · ещё 5 мин")).toBeUndefined();
  });
});
