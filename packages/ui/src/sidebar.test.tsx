// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";
import { XStack, YStack } from "@tamagui/stacks";
import { Text } from "./text";
import { Sidebar } from "./sidebar";
import { spacing } from "./tokens";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

describe("Sidebar", () => {
  it("колонка 264, landmark «Разделы», логотип и пункты", async () => {
    const { container, render } = mounted();
    await render(
      <Sidebar brand="Подарки" label="Разделы" testID="sidebar">
        <a href="/">Мой вишлист</a>
        <a href="/search">Поиск</a>
      </Sidebar>,
    );

    const sidebar = container.querySelector<HTMLElement>("[data-testid='sidebar']") as HTMLElement;
    expect(sidebar).not.toBeNull();
    expect(sidebar.tagName).toBe("NAV");
    expect(sidebar.getAttribute("aria-label")).toBe("Разделы");
    expect(sidebar.textContent).toContain("Подарки");
    expect(sidebar.querySelectorAll("a")).toHaveLength(2);
    expect(declarationsFor(sidebar, "width").map((one) => one.value)).toContain(
      "var(--t-size-sidebar)",
    );
    expect(spacing.sidebar).toBe(264);
    expect(declarationsFor(sidebar, "border-right-width").map((one) => one.value)).toContain("1px");
    expect(declarationsFor(sidebar, "border-color").map((one) => one.value)).toContain(
      "var(--border)",
    );
    expect(declarationsFor(sidebar, "background-color").map((one) => one.value)).toContain(
      "var(--surface)",
    );
  });

  it("карточка пользователя внизу: аватар, имя и @ник", async () => {
    const { container, render } = mounted();
    await render(
      <Sidebar
        brand="Подарки"
        label="Разделы"
        testID="sidebar"
        footer={
          <XStack alignItems="center" gap="$2">
            <Avatar name="Алёна Ковалёва" size="md" decorative />
            <YStack>
              <Text kind="body-strong">Алёна Ковалёва</Text>
              <Text kind="body-sm" tone="muted">
                @alena
              </Text>
            </YStack>
          </XStack>
        }
      >
        <a href="/">Мой вишлист</a>
      </Sidebar>,
    );

    expect(container.textContent).toContain("Алёна Ковалёва");
    expect(container.textContent).toContain("@alena");
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("displayName совпадает с именем компонента", () => {
    expect(Sidebar.displayName).toBe("Sidebar");
  });
});
