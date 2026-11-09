// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { LoadingCards } from "./loading-cards";
import { createMount } from "./test-utils";

const mounted = createMount();

describe("LoadingCards", () => {
  it("одна живая область «идёт загрузка» с подписью и тремя скелетонами", async () => {
    const { container, render } = mounted();
    await render(<LoadingCards label="Загружаем вишлист" testID="wishlist-loading" width={280} />);

    const region = container.querySelector<HTMLElement>('[data-testid="wishlist-loading"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("status");
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("aria-label")).toBe("Загружаем вишлист");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(3);
  });

  it("count задаёт число скелетонов, а testID по умолчанию стабилен", async () => {
    const { container, render } = mounted();
    await render(<LoadingCards label="Загружаем желание" count={1} />);

    const region = container.querySelector<HTMLElement>('[data-testid="loading-cards"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-label")).toBe("Загружаем желание");
    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(1);
  });
});
