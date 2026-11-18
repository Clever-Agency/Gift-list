// @vitest-environment happy-dom
import { act, createRef, type ComponentRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PersonRow } from "./person-row";
import { createMount } from "./test-utils";

const mounted = createMount();

describe("PersonRow", () => {
  it("показывает имя и @ник и ничего больше", async () => {
    const { container, render } = mounted();
    await render(<PersonRow displayName="Алёна" nick="alena" />);

    expect(container.textContent).toContain("Алёна");
    expect(container.textContent).toContain("@alena");
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll('[role="link"]')).toHaveLength(0);
  });

  it("с href — ровно одна настоящая ссылка с понятным именем", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <PersonRow
        displayName="Алёна"
        nick="alena"
        pressLabel="Открыть профиль @alena"
        href="/u/alena"
        onPress={onPress}
      />,
    );

    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute("href")).toBe("/u/alena");
    expect(anchors[0].getAttribute("role")).toBe("link");
    expect(anchors[0].getAttribute("aria-label")).toBe("Открыть профиль @alena");
    expect(anchors[0].textContent).toContain("Алёна");
    expect(anchors[0].textContent).toContain("@alena");
    expect(container.querySelectorAll("a a")).toHaveLength(0);

    await act(async () => {
      anchors[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("отдаёт корень ссылки в ref: так Link asChild прокидывает своё поведение", async () => {
    const ref = createRef<ComponentRef<typeof PersonRow>>();
    const { container, render } = mounted();
    await render(<PersonRow ref={ref} displayName="Алёна" nick="alena" href="/u/alena" />);

    expect(ref.current).toBe(container.querySelector("a"));
  });

  it("чип и ⋮ — рядом со ссылкой, не внутри неё", async () => {
    const { container, render } = mounted();
    await render(
      <PersonRow
        displayName="Алёна"
        nick="alena"
        pressLabel="Открыть профиль: Алёна, @alena, Друзья"
        href="/u/alena"
        chip={<span>Друзья</span>}
        actions={<button type="button">⋮</button>}
      />,
    );

    expect(container.textContent).toContain("Алёна");
    expect(container.textContent).toContain("Друзья");
    expect(container.querySelectorAll("a")).toHaveLength(1);
    // A press on the menu must not open the profile: the button is a sibling.
    expect(container.querySelectorAll("a button")).toHaveLength(0);
    expect(container.querySelector("a")?.getAttribute("aria-label")).toBe(
      "Открыть профиль: Алёна, @alena, Друзья",
    );
  });

  it("без actions ведёт себя как раньше: одна ссылка и никаких кнопок", async () => {
    const { container, render } = mounted();
    await render(
      <PersonRow displayName="Иван" nick="ivan" href="/u/ivan" pressLabel="Открыть профиль @ivan" />,
    );

    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
