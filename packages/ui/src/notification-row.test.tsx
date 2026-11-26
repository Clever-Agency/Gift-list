// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { Bell } from "./icons";
import { NotificationRow } from "./notification-row";
import { createMount, stateValues } from "./test-utils";

const mounted = createMount();

function row(container: HTMLElement): HTMLElement {
  const node = container.querySelector('[role="listitem"]');
  expect(node, "строка уведомления").not.toBeNull();
  return node as HTMLElement;
}

describe("NotificationRow: hover и плавность", () => {
  it("строка с нажатием заливается muted на hover, переход 160 мс", async () => {
    const { container, render } = mounted();
    await render(
      <NotificationRow
        message="Алёна забронировала «Плед»"
        time="2 мин назад"
        unread
        newLabel="Новое"
        icon={<Bell size={20} />}
        onPress={vi.fn()}
      />,
    );

    const press = container.querySelector('[role="button"]') as HTMLElement;
    expect(press).not.toBeNull();
    expect(stateValues(press, "hover", "background-color")).toEqual(["var(--muted)"]);
    expect(press.style.transition).toContain("160ms");
  });

  it("без нажатия строка остаётся подписью: hover-правила нет", async () => {
    const { container, render } = mounted();
    await render(
      <NotificationRow
        message="Алёна забронировала «Плед»"
        time="2 мин назад"
        unread={false}
        newLabel="Новое"
        icon={<Bell size={20} />}
      />,
    );

    expect(container.querySelector('[role="button"]')).toBeNull();
    expect(stateValues(row(container), "hover", "background-color")).toEqual([]);
  });
});
