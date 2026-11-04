// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";
import { GhostButton } from "@/ui/ghost-button";

/** The same catalogue the app ships: «Отмена» is `app.giftForm.action.cancel`, no new key. */
const cancel = (
  JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../..",
        "packages/contracts/src/i18n/ru/app.json",
      ),
      "utf8",
    ),
  ) as { giftForm: { action: { cancel: string } } }
).giftForm.action.cancel;

const ui = vi.hoisted(() => ({
  pressable: undefined as
    | {
        style?: (state: { pressed: boolean }) => unknown;
        props: Record<string, unknown>;
      }
    | undefined,
  text: undefined as { value: string; style: unknown } | undefined,
}));

vi.mock("react-native", async () => {
  const React = await import("react");

  return {
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => {
      if (typeof children === "string") ui.text = { value: children, style };
      return React.createElement("span", null, children);
    },
    /**
     * `Pressable` on the web is a `div` with `role="button"`. The mock keeps the
     * two effects that matter here: `aria-disabled` reaches the DOM, and a
     * `disabled` prop would set `tabIndex={-1}` and drop the control from the
     * tab order — the button must not rely on that. `onPress` is called even for
     * a would-be disabled Pressable, so the test proves the component itself
     * does not run it.
     */
    Pressable: (props: {
      children?: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      accessibilityRole?: string;
      accessibilityLabel?: string;
      accessibilityState?: { disabled?: boolean };
      "aria-disabled"?: boolean;
      testID?: string;
      hitSlop?: unknown;
      style?: (state: { pressed: boolean }) => unknown;
    }) => {
      ui.pressable = { style: props.style, props: { ...props } };
      return React.createElement(
        "button",
        {
          type: "button",
          role: props.accessibilityRole as React.AriaRole | undefined,
          "aria-label": props.accessibilityLabel,
          "aria-disabled": props["aria-disabled"],
          "data-testid": props.testID,
          tabIndex: props.disabled ? -1 : 0,
          ...(props.disabled ? { disabled: true } : {}),
          onClick: () => props.onPress?.(),
        },
        props.children,
      );
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Style arrays are plain objects here: `StyleSheet.create` is the identity in the mock. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, part) => ({ ...acc, ...flattenStyle(part) }),
      {},
    );
  }
  return typeof style === "object" && style !== null
    ? { ...(style as Record<string, unknown>) }
    : {};
}

/** The styles of the button in the given interaction state. */
function buttonStyle(pressed: boolean): Record<string, unknown> {
  return flattenStyle(ui.pressable?.style?.({ pressed }));
}

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  ui.pressable = undefined;
  ui.text = undefined;
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

async function render(overrides: { disabled?: boolean; testID?: string } = {}) {
  const onPress = vi.fn();
  await act(async () => {
    host.render(
      <GhostButton
        label={cancel}
        onPress={onPress}
        disabled={overrides.disabled}
        testID={overrides.testID}
      />,
    );
  });
  return onPress;
}

function button(): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>('[role="button"]');
  if (!found) throw new Error("Не найдена кнопка");
  return found;
}

describe("GhostButton: кнопка и нажатие", () => {
  it("рисует подпись «Отмена» и role button", async () => {
    await render();

    // The key exists in the catalogue; the label is passed in, not duplicated here.
    expect(typeof cancel).toBe("string");
    expect(button().textContent).toBe(cancel);
    expect(button().getAttribute("aria-label")).toBe(cancel);
  });

  it("нажатие вызывает onPress", async () => {
    const onPress = await render();

    await act(async () => {
      button().click();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("disabled: aria-disabled, но кнопка остаётся в порядке фокуса и onPress не срабатывает", async () => {
    const onPress = await render({ disabled: true });
    const node = button();

    expect(node.getAttribute("aria-disabled")).toBe("true");
    // Not `disabled` and not `tabIndex={-1}`: the control is still reachable.
    expect(node.disabled).toBe(false);
    expect(node.getAttribute("tabindex")).toBe("0");

    await act(async () => {
      node.click();
    });

    expect(onPress).not.toHaveBeenCalled();
  });

  it("testID доходит до кнопки", async () => {
    await render({ testID: "gift-cancel" });

    expect(container.querySelector('[data-testid="gift-cancel"]')).not.toBeNull();
  });
});

describe("GhostButton: токены DESIGN.md", () => {
  it("зона касания 44×44 набрана minHeight/minWidth и padding, без hitSlop", async () => {
    await render();
    const style = buttonStyle(false);

    expect(spacing["touch-target"]).toBe(44);
    expect(style.minHeight).toBe(spacing["touch-target"]);
    expect(style.minWidth).toBe(spacing["touch-target"]);
    expect(style.paddingHorizontal).toBe(spacing["grid-gap"]);
    expect(ui.pressable?.props.hitSlop).toBeUndefined();
  });

  it("фон прозрачный, подпись primary, радиус rounded.md", async () => {
    await render();

    expect(buttonStyle(false).backgroundColor).toBe("transparent");
    expect(buttonStyle(false).borderRadius).toBe(rounded.md);
    expect(flattenStyle(ui.text?.style)).toMatchObject({
      ...textStyle("button"),
      color: colors.primary,
    });
  });

  it("pressed — фон colors.muted", async () => {
    await render();

    expect(buttonStyle(true).backgroundColor).toBe(colors.muted);
  });

  it("disabled — 40% непрозрачности", async () => {
    await render({ disabled: true });

    expect(buttonStyle(false).opacity).toBe(0.4);
  });
});
