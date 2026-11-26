// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Text } from "@gift-list/ui";
import { declarationsFor } from "@/test/tamagui-css";
import { CardGridList } from "@/ui/card-grid-list";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

/** `DESIGN.md` → Layout → columns: the one grid of the app — list semantics and the shared gap. */
describe("CardGridList", () => {
  it("сетка — роль списка с общим gap, карточки лежат в ней", async () => {
    await act(async () => {
      host.render(
        <CardGridList testID="grid">
          <Text>Плед</Text>
          <Text>Кружка</Text>
        </CardGridList>,
      );
    });

    const grid = container.querySelector<HTMLElement>('[data-testid="grid"]');
    expect(grid?.getAttribute("role")).toBe("list");
    expect(grid?.textContent).toBe("ПледКружка");
    expect(
      declarationsFor(grid as Element, "gap")
        .map((declaration) => declaration.value)
        .join(" "),
    ).toContain("var(--t-space-grid-gap)");
  });

  it("alignStart выравнивает ряды по верху, без него — по умолчанию", async () => {
    await act(async () => {
      host.render(
        <CardGridList testID="grid" alignStart>
          <Text>Плед</Text>
        </CardGridList>,
      );
    });

    const grid = container.querySelector<HTMLElement>('[data-testid="grid"]');
    expect(
      declarationsFor(grid as Element, "align-items")
        .map((declaration) => declaration.value)
        .join(" "),
    ).toContain("flex-start");
  });
});
