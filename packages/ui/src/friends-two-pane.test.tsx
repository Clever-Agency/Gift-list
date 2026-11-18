// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { FriendsTwoPane } from "./friends-two-pane";
import { PersonRow } from "./person-row";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

const list = (
  <PersonRow displayName="Алёна" nick="alena" testID="friends-list-row" />
);

const detail = <PersonRow displayName="Глеб" nick="gleb" testID="friends-detail-row" />;

describe("FriendsTwoPane: вариант D", () => {
  it("две панели рядом: список слева, вишлист выбранного друга справа", async () => {
    const { container, render } = mounted();
    await render(<FriendsTwoPane list={list} detail={detail} testID="pane" />);

    expect(container.querySelector("[data-testid='pane-list']")).not.toBeNull();
    expect(container.querySelector("[data-testid='pane-detail']")).not.toBeNull();
    expect(container.textContent).toContain("Алёна");
    expect(container.textContent).toContain("Глеб");
    // Side by side with the column gap of the layout, not stacked.
    const root = container.querySelector<HTMLElement>("[data-testid='pane']") as HTMLElement;
    expect(declarationsFor(root, "flex-direction").map((one) => one.value)).toContain("row");
  });

  it("ширина списка по умолчанию 320 px и настраивается", async () => {
    const { container, render } = mounted();
    await render(<FriendsTwoPane list={list} detail={detail} testID="pane" />);

    const left = container.querySelector<HTMLElement>("[data-testid='pane-list']") as HTMLElement;
    expect(declarationsFor(left, "width").map((one) => one.value)).toContain("320px");

    await render(<FriendsTwoPane list={list} detail={detail} listWidth={280} testID="pane" />);
    const narrow = container.querySelector<HTMLElement>("[data-testid='pane-list']") as HTMLElement;
    expect(declarationsFor(narrow, "width").map((one) => one.value)).toContain("280px");
  });

  it("без выбранного друга правая панель показывает подсказку экрана", async () => {
    const { container, render } = mounted();
    await render(
      <FriendsTwoPane list={list} empty={<span>Выберите друга</span>} testID="pane" />,
    );

    expect(container.querySelector("[data-testid='pane-detail']")?.textContent).toBe(
      "Выберите друга",
    );
  });
});
