// @vitest-environment happy-dom
/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

/**
 * CLE-64 for the shared package: DevTools shows the name from the fiber type, so every
 * hand-written component of `packages/ui` is a named function with a `displayName`
 * equal to its export name. Components made with Tamagui's `styled()` carry their own
 * `name` and are skipped.
 */

const modules = import.meta.glob(["./*.tsx", "!./*.test.tsx", "!./test-utils.tsx"], {
  eager: true,
}) as Record<string, Record<string, unknown>>;

const FORWARD_REF = Symbol.for("react.forward_ref");
const MEMO = Symbol.for("react.memo");

function isStyled(value: unknown): boolean {
  return Boolean((value as { staticConfig?: unknown } | null)?.staticConfig);
}

function isComponentExport(exportName: string, value: unknown): boolean {
  if (!/^[A-Z]/.test(exportName) || isStyled(value)) return false;
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null) return false;
  const type = (value as { $$typeof?: unknown }).$$typeof;
  return type === FORWARD_REF || type === MEMO;
}

function renderName(value: unknown): string {
  if (typeof value === "function") return (value as { name?: string }).name ?? "";
  const wrapper = value as { render?: unknown; type?: unknown };
  return renderName(wrapper.render ?? wrapper.type);
}

const components = Object.entries(modules).flatMap(([module, exports]) =>
  Object.entries(exports).flatMap(([exportName, value]) =>
    isComponentExport(exportName, value)
      ? [
          {
            module,
            exportName,
            displayName: (value as { displayName?: unknown }).displayName,
            functionName: renderName(value),
          },
        ]
      : [],
  ),
);

describe("имена компонентов packages/ui", () => {
  it("находит экспорты компонентов, а не пустой список", () => {
    expect(components.map((component) => component.exportName)).toEqual(
      expect.arrayContaining([
        "Button",
        "TextField",
        "PasswordField",
        "WishCard",
        "StatusPill",
        "VisibilityChip",
        "Dialog",
        "BottomSheet",
        "Toast",
        "EmptyState",
        "GiftListProvider",
        "Heading",
      ]),
    );
  });

  it("displayName равен имени экспорта", () => {
    const wrong = components
      .filter((component) => component.displayName !== component.exportName)
      .map((component) => `${component.module} → ${component.exportName}: ${String(component.displayName)}`);

    expect(wrong).toEqual([]);
  });

  it("функция компонента не анонимная", () => {
    const anonymous = components
      .filter((component) => component.functionName.trim() === "")
      .map((component) => `${component.module} → ${component.exportName}`);

    expect(anonymous).toEqual([]);
  });
});
