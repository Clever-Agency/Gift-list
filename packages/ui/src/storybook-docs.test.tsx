// @vitest-environment happy-dom
import type { DocsContainerProps } from "@storybook/addon-docs/blocks";
import { describe, expect, it, vi } from "vitest";
import preview, { docsThemeName } from "../../../.storybook/preview";
import { createMount } from "./test-utils";

/**
 * The catalog's docs container is not a decorator or a story function, so it may
 * not call preview hooks (`useGlobals` and friends): Storybook throws «preview hooks
 * can only be called inside decorators and story functions» and the docs page —
 * including `UI/Button` — fails. It reads the theme from the docs context and
 * subscribes to the preview channel instead. This test renders it outside the
 * preview, exactly where such a hook would throw.
 */

const mounted = createMount();

type FakeChannel = { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> };

function docsContext(globals: { theme?: string } = {}) {
  const channel: FakeChannel = { on: vi.fn(), off: vi.fn() };
  const context = {
    storyById: () => ({ id: "ui-button--docs" }),
    getStoryContext: () => ({ globals }),
    channel,
    projectAnnotations: { parameters: { docs: {} } },
    resolveOf: () => {
      throw new Error("no meta on the fake entry");
    },
  };
  return { context, channel };
}

describe("Storybook docs container", () => {
  it("читает тему из контекста и слушает канал, а не preview-хуки", async () => {
    const { context, channel } = docsContext({ theme: "dark" });
    const Container = preview.parameters?.docs?.container;
    expect(Container).toBeTypeOf("function");
    if (!Container) throw new Error("The catalog has no docs container");

    const { container, render } = mounted();
    await render(
      <Container context={context as unknown as DocsContainerProps["context"]}>
        <div>docs page</div>
      </Container>,
    );

    expect(container.textContent).toContain("docs page");
    // The toolbar writes GLOBALS_UPDATED: that is the replacement for `useGlobals`.
    expect(channel.on).toHaveBeenCalledWith("globalsUpdated", expect.any(Function));
    expect(channel.off).not.toHaveBeenCalled();
  });

  it("docsThemeName: dark из глобалов, light по умолчанию и без основной истории", () => {
    expect(docsThemeName(docsContext({ theme: "dark" }).context as never)).toBe("dark");
    expect(docsThemeName(docsContext({ theme: "light" }).context as never)).toBe("light");
    expect(docsThemeName(docsContext().context as never)).toBe("light");

    const mdxOnly = {
      storyById: () => {
        throw new Error("No primary story defined for docs entry");
      },
      getStoryContext: () => ({ globals: { theme: "dark" } }),
    };
    expect(docsThemeName(mdxOnly as never)).toBe("light");
  });
});
