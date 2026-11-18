// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";
import { avatarInitials } from "./avatar.types";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

describe("Avatar: фото и инициалы", () => {
  it("без фото показывает инициалы и читается именем", async () => {
    const { container, render } = mounted();
    await render(<Avatar name="Анна Ковалёва" testID="avatar" />);

    const node = container.querySelector<HTMLElement>("[data-testid='avatar']") as HTMLElement;
    expect(node.getAttribute("role")).toBe("img");
    expect(node.getAttribute("aria-label")).toBe("Анна Ковалёва");
    expect(node.textContent).toBe("АК");
  });

  it("размеры берутся из токенов: sm 28, md 40, lg 64", async () => {
    const { container, render } = mounted();
    for (const [size, edge] of [
      ["sm", "28px"],
      ["md", "40px"],
      ["lg", "64px"],
    ] as const) {
      await render(<Avatar name="Анна Ковалёва" size={size} testID="avatar" />);
      const node = container.querySelector<HTMLElement>("[data-testid='avatar']") as HTMLElement;
      expect(declarationsFor(node, "width").map((one) => one.value), size).toContain(edge);
      expect(declarationsFor(node, "height").map((one) => one.value), size).toContain(edge);
    }
  });

  it("фото рисует картинку, текст инициалов не дублируется", async () => {
    const { container, render } = mounted();
    await render(<Avatar name="Анна Ковалёва" photoUrl="https://example.test/a.jpg" testID="avatar" />);

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://example.test/a.jpg");
    // The name is the accessible name of the wrapper; the picture itself is decorative.
    expect(image?.getAttribute("alt")).toBe("");
    expect(container.textContent).toBe("");
  });

  it("точка статуса: слово входит в имя, цвет — из семантического токена", async () => {
    const { container, render } = mounted();
    await render(
      <Avatar name="Анна Ковалёва" status="online" statusLabel="в сети" testID="avatar" />,
    );

    const node = container.querySelector<HTMLElement>("[data-testid='avatar']") as HTMLElement;
    expect(node.getAttribute("aria-label")).toBe("Анна Ковалёва, в сети");
    const dot = container.querySelector<HTMLElement>("[data-testid='avatar-status']") as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(declarationsFor(dot, "background-color").map((one) => one.value)).toContain(
      "var(--status-open)",
    );
  });

  it("decorative прячет аватар от диктора рядом с написанным именем", async () => {
    const { container, render } = mounted();
    await render(<Avatar name="Анна Ковалёва" decorative testID="avatar" />);

    const node = container.querySelector<HTMLElement>("[data-testid='avatar']") as HTMLElement;
    expect(node.getAttribute("aria-hidden")).toBe("true");
    expect(node.getAttribute("aria-label")).toBeNull();
    expect(node.getAttribute("role")).toBeNull();
  });
});

describe("avatarInitials", () => {
  it("первые буквы двух слов, верхний регистр", () => {
    expect(avatarInitials("Анна Ковалёва")).toBe("АК");
    expect(avatarInitials("  ольга   ли ")).toBe("ОЛ");
  });

  it("одно слово, пустое имя и суррогатная пара", () => {
    expect(avatarInitials("Анна")).toBe("А");
    expect(avatarInitials("   ")).toBe("");
    expect(avatarInitials("😀 Плед")).toBe("😀П");
  });
});
