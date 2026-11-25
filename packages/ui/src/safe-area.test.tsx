// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { SafeArea } from "./safe-area";
import safeAreaNativeSource from "./safe-area.native.tsx?raw";
import { createMount, declarationsFor } from "./test-utils";

const mounted = createMount();

describe("SafeArea", () => {
  it("один кадр на весь экран: дети внутри, flex 1", async () => {
    const { container, render } = mounted();
    await render(
      <SafeArea>
        <span data-testid="page" />
      </SafeArea>,
    );

    const page = container.querySelector<HTMLElement>('[data-testid="page"]');
    expect(page).not.toBeNull();
    const frame = page?.parentElement as HTMLElement;
    expect(frame.querySelectorAll('[data-testid="page"]')).toHaveLength(1);

    // `flex: 1` of the phone frame, written as its three longhands: happy-dom drops
    // the `flex` shorthand of an atomic rule (`flex: 1 0px` parses to nothing). The
    // `is_View` base rule (`flex-shrink: 0`, `flex-basis: auto`) comes first, the atom last.
    expect(declarationsFor(frame, "flex-grow").at(-1)?.value).toBe("1");
    expect(declarationsFor(frame, "flex-shrink").at(-1)?.value).toBe("1");
    expect(declarationsFor(frame, "flex-basis").at(-1)?.value).toBe("0px");
  });

  it("без текстов и лишних элементов: пустой кадр пуст", async () => {
    const { container, render } = mounted();
    await render(<SafeArea />);

    expect(container.textContent).toBe("");
  });

  it("bottom={false} на web ничего не меняет: тот же кадр без inset", async () => {
    const { container, render } = mounted();
    await render(
      <SafeArea bottom={false}>
        <span data-testid="tab-page" />
      </SafeArea>,
    );

    const page = container.querySelector<HTMLElement>('[data-testid="tab-page"]');
    expect(page).not.toBeNull();
    const frame = page?.parentElement as HTMLElement;
    expect(declarationsFor(frame, "flex-grow").at(-1)?.value).toBe("1");
    // The browser has no safe-area inset (the exported page has no viewport-fit=cover).
    expect(declarationsFor(frame, "padding-bottom")).toHaveLength(0);
  });

  it("bottom={false} на телефоне снимает только нижнюю грань", () => {
    expect(safeAreaNativeSource).toContain(
      'const edgesWithoutBottom: readonly Edge[] = ["top", "right", "left"];',
    );
    expect(safeAreaNativeSource).toContain("edges={bottom ? edgesWithBottom : edgesWithoutBottom}");
  });

  it("displayName совпадает с именем компонента", () => {
    expect(SafeArea.displayName).toBe("SafeArea");
  });
});
