// @vitest-environment happy-dom
import { act } from "react";
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
  });

  it("с onPress становится ссылкой с понятным именем", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <PersonRow
        displayName="Алёна"
        nick="alena"
        pressLabel="Открыть профиль @alena"
        onPress={onPress}
      />,
    );

    const link = container.querySelector('[role="link"]') as HTMLElement;
    expect(link.getAttribute("aria-label")).toBe("Открыть профиль @alena");

    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("Enter открывает профиль, как настоящая ссылка", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <PersonRow displayName="Алёна" nick="alena" pressLabel="Профиль" onPress={onPress} />,
    );

    const link = container.querySelector('[role="link"]') as HTMLElement;
    await act(async () => {
      link.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
