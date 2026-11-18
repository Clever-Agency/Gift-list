// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { useTheme } from "@tamagui/core";
import { Button } from "./button";
import { createGiftListConfig } from "./config";
import { GiftListProvider } from "./provider";
import { Text } from "./text";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

/** The active theme values, as the components see them. */
function TokenProbe() {
  const theme = useTheme() as unknown as Record<string, { val?: string } | undefined>;
  return (
    <Text testID="token-probe">
      {[theme.background?.val, theme.primary?.val, theme.surface?.val].join("|")}
    </Text>
  );
}

TokenProbe.displayName = "TokenProbe";

function dark(element: React.ReactElement) {
  return (
    <GiftListProvider config={createGiftListConfig({ body: "Manrope", heading: "Lora" })} theme="dark">
      {element}
    </GiftListProvider>
  );
}

describe("тёмная тема v8", () => {
  it("useTheme отдаёт тёмные значения токенов, светлая — светлые", async () => {
    const { container, render } = mounted();

    await render(<TokenProbe />);
    expect(container.querySelector("[data-testid='token-probe']")?.textContent).toBe(
      "#F3F1EC|#2B3A7A|#FFFEFB",
    );

    await render(dark(<TokenProbe />));
    expect(container.querySelector("[data-testid='token-probe']")?.textContent).toBe(
      "#0E0E20|#7C8CFF|#1B1B3A",
    );
  });

  it("провайдер ставит класс тёмной темы, а цвет компонента идёт из неё, не из токена", async () => {
    const { container, render } = mounted();
    await render(dark(<Button label="Кнопка" variant="primary" testID="dark-button" />));

    const darkRoot = document.querySelector(".t_dark");
    expect(darkRoot, "класс t_dark на корне провайдера").not.toBeNull();

    const button = container.querySelector("[data-testid='dark-button']") as HTMLElement;
    // Colours are theme values now: a colour token would freeze them to light.
    const background = declarationsFor(button, "background-color").map((one) => one.value);
    expect(background).toContain("var(--primary)");
    expect(background.join(" ")).not.toContain("--c-");
    // The dark primary is periwinkle, the light one is navy.
    expect(getComputedStyle(button).backgroundColor).toBe("#7C8CFF");
  });

  it("светлая тема остаётся по умолчанию и не меняет цвет primary", async () => {
    const { container, render } = mounted();
    await render(<Button label="Кнопка" variant="primary" testID="light-button" />);

    const button = container.querySelector("[data-testid='light-button']") as HTMLElement;
    expect(document.querySelector(".t_light"), "класс t_light").not.toBeNull();
    expect(getComputedStyle(button).backgroundColor).toBe("#2B3A7A");
  });
});
