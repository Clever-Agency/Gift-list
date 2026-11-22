// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it } from "vitest";
import { SkipLink } from "./skip-link";
import skipLinkNativeSource from "./skip-link.native.tsx?raw";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

describe("SkipLink", () => {
  it("это ссылка на main#main-content с текстом каталога", async () => {
    const { container, render } = mounted();
    await render(<SkipLink label="Перейти к содержимому" testID="skip" />);

    const link = container.querySelector<HTMLAnchorElement>("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("#main-content");
    expect(link?.textContent).toBe("Перейти к содержимому");
  });

  it("скрыта до фокуса и показывается, когда фокус на ней", async () => {
    const { container, render } = mounted();
    await render(<SkipLink label="Перейти к содержимому" testID="skip" />);

    const link = container.querySelector<HTMLElement>("[data-testid='skip']") as HTMLElement;
    expect(declarationsFor(link, "opacity").map((one) => one.value)).toContain("0");
    expect(declarationsFor(link, "pointer-events").map((one) => one.value)).toContain("none");

    await act(async () => {
      link.focus();
    });
    expect(declarationsFor(link, "opacity").map((one) => one.value)).toContain("1");
    expect(declarationsFor(link, "pointer-events").map((one) => one.value)).toContain("auto");
  });

  it("displayName совпадает с именем компонента", () => {
    expect(SkipLink.displayName).toBe("SkipLink");
  });

  it("на телефоне ссылки нет: собственный twin рисует null", () => {
    expect(skipLinkNativeSource).toContain("return null");
    expect(skipLinkNativeSource).toContain('SkipLink.displayName = "SkipLink"');
  });
});
