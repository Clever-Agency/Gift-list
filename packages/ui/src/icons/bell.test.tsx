// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createMount } from "../test-utils";
import { Bell } from "./Bell";

const mounted = createMount();

/**
 * The web twin is an inline `<svg>`: its `stroke` is the colour prop, exactly as
 * in the other icons. Without the prop it falls back to `currentColor`, so a host
 * may tint it with text colour.
 */
describe("Bell (web)", () => {
  it("рисует штрих переданным цветом, в том числе у пути", async () => {
    const { container, render } = mounted();
    await render(<Bell color="#2B3A7A" testID="bell" />);

    const svg = container.querySelector<SVGElement>("[data-testid='bell']");
    expect(svg?.getAttribute("stroke")).toBe("#2B3A7A");
    expect(container.querySelector("path")?.getAttribute("stroke")).toBe("#2B3A7A");
  });

  it("без color берёт currentColor и остаётся декоративным", async () => {
    const { container, render } = mounted();
    await render(<Bell />);

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
  });

  it("размер по умолчанию 24, переданный — используется", async () => {
    const { container, render } = mounted();
    await render(<Bell size={20} />);

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.getAttribute("height")).toBe("20");
  });
});
