// @vitest-environment happy-dom
/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

/**
 * CLE-64 for the shared package: DevTools shows the name from the fiber type, so every
 * hand-written component of `packages/ui` is a named function with a `displayName`
 * equal to its export name. Components made with Tamagui's `styled()` carry their own
 * `name` and are skipped.
 *
 * `*.native.tsx` twins cannot be imported here: they pull `react-native` in, whose Flow
 * sources happy-dom does not parse (`spinner.native.tsx`). Their source is read as text
 * instead — the `export function Name(` + `Name.displayName = "Name"` pair — and a
 * native module with no RN import (like `spinner-a11y.native.ts`) is covered by its own
 * `*.native.test` file.
 */

const modules = import.meta.glob(["./*.tsx", "!./*.native.tsx", "!./*.test.tsx", "!./test-utils.tsx"], {
  eager: true,
}) as Record<string, Record<string, unknown>>;

/** The sources of the native twins, read as text because they cannot be imported. */
const nativeModules = import.meta.glob("./*.native.tsx", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

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

describe("имена компонентов packages/ui в *.native.tsx", () => {
  it("нативные двойники находятся, а не пустой список", () => {
    expect(Object.keys(nativeModules)).toContain("./spinner.native.tsx");
  });

  it("у каждого именованного компонента есть displayName, равный имени функции", () => {
    const missing: string[] = [];
    for (const [module, source] of Object.entries(nativeModules)) {
      for (const [, name] of source.matchAll(/export function ([A-Z][A-Za-z0-9_]*)\s*\(/g)) {
        if (!source.includes(`${name}.displayName = "${name}"`)) missing.push(`${module} → ${name}`);
      }
    }

    expect(missing).toEqual([]);
  });
});
